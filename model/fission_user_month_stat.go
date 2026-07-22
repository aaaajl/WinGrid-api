package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm/clause"
)

// FissionUserMonthStat stores invitee paid-consumption base for one calendar month.
// Unique key: (period_month, user_id) where user_id is the invitee.
type FissionUserMonthStat struct {
	Id                     int     `json:"id" gorm:"primaryKey"`
	PeriodMonth            string  `json:"period_month" gorm:"type:varchar(7);uniqueIndex:uk_fission_period_user,priority:1"`
	UserId                 int     `json:"user_id" gorm:"uniqueIndex:uk_fission_period_user,priority:2;index"`
	InviterId              int     `json:"inviter_id" gorm:"index"`
	EligibleQuota          int64   `json:"eligible_quota" gorm:"default:0"`
	BaseCnyCents           int64   `json:"base_cny_cents" gorm:"default:0"` // CNY in fen
	QuotaPerUnitSnapshot   float64 `json:"quota_per_unit_snapshot"`
	UsdExchangeRateSnapshot float64 `json:"usd_exchange_rate_snapshot"`
	AsOfDate               string  `json:"as_of_date" gorm:"type:varchar(10)"`
	GiftConsumedQuota      int64   `json:"gift_consumed_quota" gorm:"default:0"`
	UpdatedAt              int64   `json:"updated_at" gorm:"bigint"`
}

func (FissionUserMonthStat) TableName() string {
	return "fission_user_month_stats"
}

func UpsertFissionUserMonthStat(stat *FissionUserMonthStat) error {
	if stat == nil {
		return nil
	}
	if stat.UpdatedAt == 0 {
		stat.UpdatedAt = common.GetTimestamp()
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "period_month"},
			{Name: "user_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"inviter_id":                 stat.InviterId,
			"eligible_quota":             stat.EligibleQuota,
			"base_cny_cents":             stat.BaseCnyCents,
			"quota_per_unit_snapshot":    stat.QuotaPerUnitSnapshot,
			"usd_exchange_rate_snapshot": stat.UsdExchangeRateSnapshot,
			"as_of_date":                 stat.AsOfDate,
			"gift_consumed_quota":        stat.GiftConsumedQuota,
			"updated_at":                stat.UpdatedAt,
		}),
	}).Create(stat).Error
}

type FissionInviterAggRow struct {
	InviterId     int    `json:"inviter_id"`
	InviteeCount  int64  `json:"invitee_count"`
	BaseCnyCents  int64  `json:"base_cny_cents"`
	AsOfDate      string `json:"as_of_date"`
}

func ListFissionInviteesByInviter(periodMonth string, inviterId int) ([]*FissionUserMonthStat, error) {
	var rows []*FissionUserMonthStat
	err := DB.Where("period_month = ? AND inviter_id = ? AND eligible_quota > 0", periodMonth, inviterId).
		Order("user_id ASC").
		Find(&rows).Error
	return rows, err
}

func AggregateFissionByInviter(periodMonth string) ([]FissionInviterAggRow, error) {
	var rows []FissionInviterAggRow
	err := DB.Model(&FissionUserMonthStat{}).
		Select("inviter_id, COUNT(*) AS invitee_count, SUM(base_cny_cents) AS base_cny_cents, MAX(as_of_date) AS as_of_date").
		Where("period_month = ? AND eligible_quota > 0 AND inviter_id > 0", periodMonth).
		Group("inviter_id").
		Order("base_cny_cents DESC").
		Scan(&rows).Error
	return rows, err
}

func CountFissionStats(periodMonth string, eligibleOnly bool) (int64, error) {
	q := DB.Model(&FissionUserMonthStat{}).Where("period_month = ?", periodMonth)
	if eligibleOnly {
		q = q.Where("eligible_quota > 0")
	}
	var n int64
	err := q.Count(&n).Error
	return n, err
}

func GetFissionPeriodAsOfDate(periodMonth string) (string, error) {
	var asOf string
	err := DB.Model(&FissionUserMonthStat{}).
		Select("MAX(as_of_date)").
		Where("period_month = ?", periodMonth).
		Scan(&asOf).Error
	return asOf, err
}

func SumFissionBaseCnyCentsByInviters(periodMonth string, inviterIds []int) (map[int]int64, error) {
	out := make(map[int]int64, len(inviterIds))
	if len(inviterIds) == 0 {
		return out, nil
	}
	type row struct {
		InviterId    int
		BaseCnyCents int64
	}
	var rows []row
	err := DB.Model(&FissionUserMonthStat{}).
		Select("inviter_id, SUM(base_cny_cents) AS base_cny_cents").
		Where("period_month = ? AND inviter_id IN ? AND eligible_quota > 0", periodMonth, inviterIds).
		Group("inviter_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.InviterId] = r.BaseCnyCents
	}
	return out, nil
}

func ListInviteeUserIds(limit, offset int) ([]User, error) {
	var users []User
	q := DB.Model(&User{}).Select("id, username, inviter_id").
		Where("inviter_id > 0")
	if limit > 0 {
		q = q.Limit(limit).Offset(offset)
	}
	err := q.Order("id ASC").Find(&users).Error
	return users, err
}

func CountInviteeUsers() (int64, error) {
	var n int64
	err := DB.Model(&User{}).Where("inviter_id > 0").Count(&n).Error
	return n, err
}

func GetUserInviterId(userId int) (int, error) {
	var inviterId int
	err := DB.Model(&User{}).Select("inviter_id").Where("id = ?", userId).Scan(&inviterId).Error
	return inviterId, err
}
