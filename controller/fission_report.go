package controller

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/fission"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

func GetFissionMeta(c *gin.Context) {
	cfg := operation_setting.GetFissionSetting()
	period := c.Query("period_month")
	asOf := ""
	var periodStatRows, periodEligibleRows int64
	if period != "" {
		asOf, _ = model.GetFissionPeriodAsOfDate(period)
		periodStatRows, _ = model.CountFissionStats(period, false)
		periodEligibleRows, _ = model.CountFissionStats(period, true)
	}
	inviteeCount, _ := model.CountInviteeUsers()
	refreshing := false
	if active, err := model.GetActiveSystemTask(model.SystemTaskTypeFissionDailyRefresh); err == nil && active != nil {
		refreshing = true
	}
	common.ApiSuccess(c, gin.H{
		"enabled":              cfg.Enabled,
		"default_rate":         cfg.DefaultRate,
		"min_payout_cny":       cfg.MinPayoutCNY,
		"timezone":             cfg.Timezone,
		"start_period":         cfg.StartPeriod,
		"refreshing":           refreshing,
		"as_of_date":           asOf,
		"invitee_user_count":   inviteeCount,
		"period_stat_rows":     periodStatRows,
		"period_eligible_rows": periodEligibleRows,
		"compliance_confirmed": operation_setting.IsPaymentComplianceConfirmed(),
	})
}

func GetFissionReport(c *gin.Context) {
	period := c.Query("period_month")
	rate, err := strconv.ParseFloat(c.Query("rate"), 64)
	if err != nil || rate <= 0 {
		common.ApiErrorMsg(c, "invalid rate")
		return
	}
	if rate > 1 {
		rate = rate / 100
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	inviterId, _ := strconv.Atoi(c.Query("inviter_id"))
	res, err := fission.BuildReport(fission.ReportQuery{
		PeriodMonth: period,
		Rate:        rate,
		Status:      c.Query("status"),
		InviterID:   inviterId,
		Keyword:     c.Query("keyword"),
		Page:        page,
		PageSize:    pageSize,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, res)
}

func GetFissionReportItems(c *gin.Context) {
	period := c.Query("period_month")
	inviterId, err := strconv.Atoi(c.Query("inviter_id"))
	if err != nil || inviterId <= 0 {
		common.ApiErrorMsg(c, "invalid inviter_id")
		return
	}
	items, err := fission.ListInviteeItems(period, inviterId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, items)
}

func ExportFissionReport(c *gin.Context) {
	period := c.Query("period_month")
	rate, err := strconv.ParseFloat(c.Query("rate"), 64)
	if err != nil || rate <= 0 {
		common.ApiErrorMsg(c, "invalid rate")
		return
	}
	if rate > 1 {
		rate = rate / 100
	}
	data, err := fission.ExportCSV(fission.ReportQuery{
		PeriodMonth: period,
		Rate:        rate,
		Status:      c.Query("status"),
		Keyword:     c.Query("keyword"),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	filename := "fission-report-" + period + ".csv"
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
}

type fissionMarkPaidReq struct {
	PeriodMonth string  `json:"period_month"`
	InviterIds  []int   `json:"inviter_ids"`
	Rate        float64 `json:"rate"`
	Voucher     string  `json:"voucher"`
	Remark      string  `json:"remark"`
}

func MarkFissionPaid(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "payment compliance not confirmed")
		return
	}
	var req fissionMarkPaidReq
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	rate := req.Rate
	if rate > 1 {
		rate = rate / 100
	}
	operatorId := c.GetInt("id")
	n, err := fission.MarkPaid(fission.MarkPaidRequest{
		PeriodMonth: req.PeriodMonth,
		InviterIds:  req.InviterIds,
		Rate:        rate,
		Voucher:     req.Voucher,
		Remark:      req.Remark,
		OperatorId:  operatorId,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"marked": n})
}

type fissionHoldReq struct {
	PeriodMonth string `json:"period_month"`
	InviterId   int    `json:"inviter_id"`
	Hold        bool   `json:"hold"`
}

func HoldFissionPayout(c *gin.Context) {
	var req fissionHoldReq
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := fission.HoldPayout(req.PeriodMonth, req.InviterId, req.Hold, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type fissionRefreshReq struct {
	PeriodMonth string `json:"period_month"`
	AsOfDate    string `json:"as_of_date"`
	UserId      int    `json:"user_id"`
}

// RefreshFissionReport runs recalculation synchronously and returns the summary.
// Async SystemTask remains for the daily scheduler only — manual refresh must not
// depend on the master-node task runner (easy to leave pending on slave/dev).
func RefreshFissionReport(c *gin.Context) {
	if !operation_setting.GetFissionSetting().Enabled {
		common.ApiErrorMsg(c, "fission report is disabled")
		return
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiErrorMsg(c, "payment compliance not confirmed")
		return
	}
	var req fissionRefreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PeriodMonth == "" {
		common.ApiErrorMsg(c, "period_month is required")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Minute)
	defer cancel()

	summary, err := fission.RunRefresh(ctx, fission.RefreshRequest{
		PeriodMonth: req.PeriodMonth,
		AsOfDate:    req.AsOfDate,
		UserID:      req.UserId,
		Manual:      true,
	}, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func GetFissionRefreshTask(c *gin.Context) {
	taskId := c.Param("task_id")
	task, err := model.GetSystemTaskByTaskID(taskId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if task == nil || task.Type != model.SystemTaskTypeFissionDailyRefresh {
		common.ApiErrorMsg(c, "task not found")
		return
	}
	common.ApiSuccess(c, task.ToResponse())
}
