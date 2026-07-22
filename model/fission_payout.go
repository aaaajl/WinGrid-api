package model

import (
	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm/clause"
)

const (
	FissionPayoutStatusUnpaid = "unpaid"
	FissionPayoutStatusHeld   = "held"
	FissionPayoutStatusPaid   = "paid"
)

// FissionPayoutRecord stores inviter-level payout status for a month.
type FissionPayoutRecord struct {
	Id             int     `json:"id" gorm:"primaryKey"`
	PeriodMonth    string  `json:"period_month" gorm:"type:varchar(7);uniqueIndex:uk_fission_payout,priority:1"`
	InviterId      int     `json:"inviter_id" gorm:"uniqueIndex:uk_fission_payout,priority:2;index"`
	Status         string  `json:"status" gorm:"type:varchar(32);index;default:unpaid"`
	PaidAmountCents int64  `json:"paid_amount_cents" gorm:"default:0"`
	PaidRate       float64 `json:"paid_rate" gorm:"default:0"`
	BaseCnyAtPayCents int64 `json:"base_cny_at_pay_cents" gorm:"default:0"`
	Voucher        string  `json:"voucher" gorm:"type:varchar(255);default:''"`
	Remark         string  `json:"remark" gorm:"type:varchar(512);default:''"`
	PaidAt         int64   `json:"paid_at" gorm:"bigint;default:0"`
	OperatorId     int     `json:"operator_id" gorm:"default:0"`
	UpdatedAt      int64   `json:"updated_at" gorm:"bigint"`
}

func (FissionPayoutRecord) TableName() string {
	return "fission_payout_records"
}

func UpsertFissionPayoutRecord(rec *FissionPayoutRecord) error {
	if rec == nil {
		return nil
	}
	if rec.UpdatedAt == 0 {
		rec.UpdatedAt = common.GetTimestamp()
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "period_month"},
			{Name: "inviter_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"status":                rec.Status,
			"paid_amount_cents":     rec.PaidAmountCents,
			"paid_rate":             rec.PaidRate,
			"base_cny_at_pay_cents": rec.BaseCnyAtPayCents,
			"voucher":               rec.Voucher,
			"remark":                rec.Remark,
			"paid_at":               rec.PaidAt,
			"operator_id":           rec.OperatorId,
			"updated_at":            rec.UpdatedAt,
		}),
	}).Create(rec).Error
}

func GetFissionPayoutRecords(periodMonth string, inviterIds []int) (map[int]*FissionPayoutRecord, error) {
	out := make(map[int]*FissionPayoutRecord)
	if periodMonth == "" {
		return out, nil
	}
	var rows []*FissionPayoutRecord
	q := DB.Where("period_month = ?", periodMonth)
	if len(inviterIds) > 0 {
		q = q.Where("inviter_id IN ?", inviterIds)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.InviterId] = r
	}
	return out, nil
}

func GetFissionPayoutRecord(periodMonth string, inviterId int) (*FissionPayoutRecord, error) {
	var rec FissionPayoutRecord
	err := DB.Where("period_month = ? AND inviter_id = ?", periodMonth, inviterId).First(&rec).Error
	if err != nil {
		return nil, err
	}
	return &rec, nil
}
