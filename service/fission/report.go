package fission

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type ReportQuery struct {
	PeriodMonth string
	Rate        float64
	Status      string // unpaid|paid|held|skipped|"" 
	InviterID   int
	Keyword     string
	Page        int
	PageSize    int
}

type ReportRow struct {
	InviterId      int     `json:"inviter_id"`
	Username       string  `json:"username"`
	InviteeCount   int64   `json:"invitee_count"`
	BaseCNY        float64 `json:"base_cny"`
	Rate           float64 `json:"rate"`
	RewardCNY      float64 `json:"reward_cny"`
	Skipped        bool    `json:"skipped"`
	PayoutStatus   string  `json:"payout_status"`
	AsOfDate       string  `json:"as_of_date"`
	PaidAmountCNY  *float64 `json:"paid_amount_cny"`
	PaidRate       *float64 `json:"paid_rate,omitempty"`
}

type ReportResult struct {
	Items    []ReportRow `json:"items"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	AsOfDate string      `json:"as_of_date"`
	Rate     float64     `json:"rate"`
}

type InviteeItem struct {
	UserId         int     `json:"user_id"`
	Username       string  `json:"username"`
	EligibleQuota  int64   `json:"eligible_quota"`
	BaseCNY        float64 `json:"base_cny"`
	AsOfDate       string  `json:"as_of_date"`
}

// BuildReport aggregates invitee stats by inviter and applies rate in real time.
func BuildReport(q ReportQuery) (*ReportResult, error) {
	cfg := operation_setting.GetFissionSetting()
	if q.PeriodMonth < cfg.StartPeriod {
		return nil, ErrFissionPeriodTooEarly
	}
	if q.Rate <= 0 || q.Rate > 1 {
		return nil, fmt.Errorf("rate must be in (0, 1]")
	}
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	aggs, err := model.AggregateFissionByInviter(q.PeriodMonth)
	if err != nil {
		return nil, err
	}
	asOf, _ := model.GetFissionPeriodAsOfDate(q.PeriodMonth)

	inviterIds := make([]int, 0, len(aggs))
	for _, a := range aggs {
		if q.InviterID > 0 && a.InviterId != q.InviterID {
			continue
		}
		inviterIds = append(inviterIds, a.InviterId)
	}

	payouts, err := model.GetFissionPayoutRecords(q.PeriodMonth, inviterIds)
	if err != nil {
		return nil, err
	}

	usernames := map[int]string{}
	if len(inviterIds) > 0 {
		var users []model.User
		if err := model.DB.Select("id, username").Where("id IN ?", inviterIds).Find(&users).Error; err != nil {
			return nil, err
		}
		for _, u := range users {
			usernames[u.Id] = u.Username
		}
	}

	rows := make([]ReportRow, 0, len(aggs))
	for _, a := range aggs {
		if q.InviterID > 0 && a.InviterId != q.InviterID {
			continue
		}
		name := usernames[a.InviterId]
		if q.Keyword != "" && name != q.Keyword && strconv.Itoa(a.InviterId) != q.Keyword {
			continue
		}
		base := CentsToYuan(a.BaseCnyCents)
		reward := CalculateReward(RewardInput{
			BaseCNY: base,
			Rate:    q.Rate,
			MinCNY:  cfg.MinPayoutCNY,
		})
		payoutStatus := model.FissionPayoutStatusUnpaid
		var paidAmt *float64
		var paidRate *float64
		if p, ok := payouts[a.InviterId]; ok {
			payoutStatus = p.Status
			if p.Status == model.FissionPayoutStatusPaid {
				v := CentsToYuan(p.PaidAmountCents)
				paidAmt = &v
				r := p.PaidRate
				paidRate = &r
			}
		}
		displayStatus := payoutStatus
		if reward.Skipped && payoutStatus == model.FissionPayoutStatusUnpaid {
			displayStatus = "skipped"
		}
		if q.Status != "" {
			if q.Status == "skipped" {
				if !reward.Skipped || payoutStatus == model.FissionPayoutStatusPaid {
					continue
				}
			} else if displayStatus != q.Status && payoutStatus != q.Status {
				continue
			}
		}
		asOfRow := a.AsOfDate
		if asOfRow == "" {
			asOfRow = asOf
		}
		rows = append(rows, ReportRow{
			InviterId:     a.InviterId,
			Username:      name,
			InviteeCount:  a.InviteeCount,
			BaseCNY:       base,
			Rate:          q.Rate,
			RewardCNY:     reward.PayCNY,
			Skipped:       reward.Skipped,
			PayoutStatus:  displayStatus,
			AsOfDate:      asOfRow,
			PaidAmountCNY: paidAmt,
			PaidRate:      paidRate,
		})
	}

	total := len(rows)
	start := (q.Page - 1) * q.PageSize
	if start > total {
		start = total
	}
	end := start + q.PageSize
	if end > total {
		end = total
	}

	return &ReportResult{
		Items:    rows[start:end],
		Total:    total,
		Page:     q.Page,
		PageSize: q.PageSize,
		AsOfDate: asOf,
		Rate:     q.Rate,
	}, nil
}

func ListInviteeItems(periodMonth string, inviterId int) ([]InviteeItem, error) {
	stats, err := model.ListFissionInviteesByInviter(periodMonth, inviterId)
	if err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(stats))
	for _, s := range stats {
		ids = append(ids, s.UserId)
	}
	names := map[int]string{}
	if len(ids) > 0 {
		var users []model.User
		_ = model.DB.Select("id, username").Where("id IN ?", ids).Find(&users)
		for _, u := range users {
			names[u.Id] = u.Username
		}
	}
	out := make([]InviteeItem, 0, len(stats))
	for _, s := range stats {
		out = append(out, InviteeItem{
			UserId:        s.UserId,
			Username:      names[s.UserId],
			EligibleQuota: s.EligibleQuota,
			BaseCNY:       CentsToYuan(s.BaseCnyCents),
			AsOfDate:      s.AsOfDate,
		})
	}
	return out, nil
}

type MarkPaidRequest struct {
	PeriodMonth string
	InviterIds  []int
	Rate        float64
	Voucher     string
	Remark      string
	OperatorId  int
}

func MarkPaid(req MarkPaidRequest) (int, error) {
	cfg := operation_setting.GetFissionSetting()
	if req.Rate <= 0 || req.Rate > 1 {
		return 0, fmt.Errorf("rate must be in (0, 1]")
	}
	bases, err := model.SumFissionBaseCnyCentsByInviters(req.PeriodMonth, req.InviterIds)
	if err != nil {
		return 0, err
	}
	marked := 0
	now := common.GetTimestamp()
	for _, id := range req.InviterIds {
		baseCents := bases[id]
		base := CentsToYuan(baseCents)
		reward := CalculateReward(RewardInput{BaseCNY: base, Rate: req.Rate, MinCNY: cfg.MinPayoutCNY})
		if reward.Skipped {
			continue
		}
		rec := &model.FissionPayoutRecord{
			PeriodMonth:       req.PeriodMonth,
			InviterId:         id,
			Status:            model.FissionPayoutStatusPaid,
			PaidAmountCents:   YuanToCents(reward.PayCNY),
			PaidRate:          req.Rate,
			BaseCnyAtPayCents: baseCents,
			Voucher:           req.Voucher,
			Remark:            req.Remark,
			PaidAt:            now,
			OperatorId:        req.OperatorId,
			UpdatedAt:         now,
		}
		if err := model.UpsertFissionPayoutRecord(rec); err != nil {
			return marked, err
		}
		marked++
	}
	return marked, nil
}

func HoldPayout(periodMonth string, inviterId int, hold bool, operatorId int) error {
	status := model.FissionPayoutStatusHeld
	if !hold {
		status = model.FissionPayoutStatusUnpaid
	}
	now := common.GetTimestamp()
	rec := &model.FissionPayoutRecord{
		PeriodMonth: periodMonth,
		InviterId:   inviterId,
		Status:      status,
		OperatorId:  operatorId,
		UpdatedAt:   now,
	}
	// preserve paid fields if exist
	if existing, err := model.GetFissionPayoutRecord(periodMonth, inviterId); err == nil && existing != nil {
		if existing.Status == model.FissionPayoutStatusPaid {
			return fmt.Errorf("cannot hold a paid record")
		}
		rec.PaidAmountCents = existing.PaidAmountCents
		rec.PaidRate = existing.PaidRate
		rec.BaseCnyAtPayCents = existing.BaseCnyAtPayCents
		rec.Voucher = existing.Voucher
		rec.Remark = existing.Remark
		rec.PaidAt = existing.PaidAt
	}
	return model.UpsertFissionPayoutRecord(rec)
}

func ExportCSV(q ReportQuery) ([]byte, error) {
	q.Page = 1
	q.PageSize = 100000
	res, err := BuildReport(q)
	if err != nil {
		return nil, err
	}
	buf := &bytes.Buffer{}
	w := csv.NewWriter(buf)
	_ = w.Write([]string{
		"inviter_id", "username", "invitee_count", "base_cny", "rate",
		"reward_cny", "skipped", "payout_status", "as_of_date", "paid_amount_cny",
	})
	for _, row := range res.Items {
		paid := ""
		if row.PaidAmountCNY != nil {
			paid = fmt.Sprintf("%.2f", *row.PaidAmountCNY)
		}
		_ = w.Write([]string{
			strconv.Itoa(row.InviterId),
			row.Username,
			strconv.FormatInt(row.InviteeCount, 10),
			fmt.Sprintf("%.2f", row.BaseCNY),
			fmt.Sprintf("%.4f", row.Rate),
			fmt.Sprintf("%.2f", row.RewardCNY),
			strconv.FormatBool(row.Skipped),
			row.PayoutStatus,
			row.AsOfDate,
			paid,
		})
	}
	w.Flush()
	return buf.Bytes(), w.Error()
}

type Meta struct {
	Enabled      bool    `json:"enabled"`
	DefaultRate  float64 `json:"default_rate"`
	MinPayoutCNY float64 `json:"min_payout_cny"`
	Timezone     string  `json:"timezone"`
	StartPeriod  string  `json:"start_period"`
	Refreshing   bool    `json:"refreshing"`
	AsOfDate     string  `json:"as_of_date,omitempty"`
}
