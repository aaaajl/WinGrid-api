package fission

import (
	"context"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/shopspring/decimal"
)

// billingSourceSubscription mirrors service.BillingSourceSubscription without
// importing the parent service package (avoids heavy deps / import cycles).
const billingSourceSubscription = "subscription"

type ExcludeSubscriptionFilter struct{}

func (ExcludeSubscriptionFilter) Name() string { return "exclude_subscription" }

func (ExcludeSubscriptionFilter) Allow(ev ConsumeEvent) bool {
	return ev.BillingSource != billingSourceSubscription
}

type LogConsumeLoader struct{}

func (LogConsumeLoader) ListConsumes(ctx context.Context, userID int, fromTs, toTs int64) ([]ConsumeEvent, error) {
	_ = ctx
	var logs []*model.Log
	q := model.LOG_DB.Model(&model.Log{}).
		Where("user_id = ? AND type = ? AND created_at < ?", userID, model.LogTypeConsume, toTs)
	if fromTs > 0 {
		q = q.Where("created_at >= ?", fromTs)
	}
	if err := q.Order("created_at ASC, id ASC").Find(&logs).Error; err != nil {
		return nil, err
	}
	out := make([]ConsumeEvent, 0, len(logs))
	for _, l := range logs {
		if l.Quota <= 0 {
			continue
		}
		billingSource := ""
		var other map[string]interface{}
		if l.Other != "" {
			_ = common.UnmarshalJsonStr(l.Other, &other)
			if v, ok := other["billing_source"].(string); ok {
				billingSource = v
			}
		}
		out = append(out, ConsumeEvent{
			UserID:        userID,
			Quota:         int64(l.Quota),
			OccurredAt:    l.CreatedAt,
			BillingSource: billingSource,
			RawOther:      []byte(l.Other),
		})
	}
	return out, nil
}

type TopupCreditClassifier struct{}

func (TopupCreditClassifier) Name() string { return "topup" }

func (TopupCreditClassifier) ListCredits(ctx context.Context, userID int, fromTs, toTs int64) ([]CreditEvent, error) {
	_ = ctx
	var topups []*model.TopUp
	q := model.DB.Where("user_id = ? AND status = ?", userID, common.TopUpStatusSuccess).
		Where("(complete_time = 0 AND create_time < ?) OR (complete_time > 0 AND complete_time < ?)", toTs, toTs)
	if fromTs > 0 {
		q = q.Where("(complete_time = 0 AND create_time >= ?) OR (complete_time >= ?)", fromTs, fromTs)
	}
	if err := q.Find(&topups).Error; err != nil {
		return nil, err
	}
	out := make([]CreditEvent, 0, len(topups))
	for _, t := range topups {
		quota := topupToQuota(t)
		if quota <= 0 {
			continue
		}
		at := t.CompleteTime
		if at <= 0 {
			at = t.CreateTime
		}
		out = append(out, CreditEvent{
			UserID:     userID,
			Quota:      quota,
			OccurredAt: at,
			Source:     "topup",
			Kind:       CreditKindPaid,
		})
	}
	return out, nil
}

func topupToQuota(t *model.TopUp) int64 {
	dUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	if t.PaymentProvider == model.PaymentProviderStripe || t.PaymentMethod == model.PaymentMethodStripe {
		return decimal.NewFromFloat(t.Money).Mul(dUnit).IntPart()
	}
	return decimal.NewFromInt(t.Amount).Mul(dUnit).IntPart()
}

type CheckinCreditClassifier struct{}

func (CheckinCreditClassifier) Name() string { return "checkin" }

func (CheckinCreditClassifier) ListCredits(ctx context.Context, userID int, fromTs, toTs int64) ([]CreditEvent, error) {
	_ = ctx
	var rows []model.Checkin
	q := model.DB.Where("user_id = ? AND created_at < ?", userID, toTs)
	if fromTs > 0 {
		q = q.Where("created_at >= ?", fromTs)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]CreditEvent, 0, len(rows))
	for _, r := range rows {
		if r.QuotaAwarded <= 0 {
			continue
		}
		out = append(out, CreditEvent{
			UserID:     userID,
			Quota:      int64(r.QuotaAwarded),
			OccurredAt: r.CreatedAt,
			Source:     "checkin",
			Kind:       CreditKindGift,
		})
	}
	return out, nil
}

type RedemptionCreditClassifier struct{}

func (RedemptionCreditClassifier) Name() string { return "redemption" }

func (RedemptionCreditClassifier) ListCredits(ctx context.Context, userID int, fromTs, toTs int64) ([]CreditEvent, error) {
	_ = ctx
	var rows []model.Redemption
	q := model.DB.Where("used_user_id = ? AND redeemed_time > 0 AND redeemed_time < ?", userID, toTs)
	if fromTs > 0 {
		q = q.Where("redeemed_time >= ?", fromTs)
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]CreditEvent, 0, len(rows))
	for _, r := range rows {
		if r.Quota <= 0 {
			continue
		}
		out = append(out, CreditEvent{
			UserID:     userID,
			Quota:      int64(r.Quota),
			OccurredAt: r.RedeemedTime,
			Source:     "redemption",
			Kind:       CreditKindGift,
		})
	}
	return out, nil
}

// SystemGiftCreditClassifier treats register/invitee gift system logs as gift credits.
type SystemGiftCreditClassifier struct{}

func (SystemGiftCreditClassifier) Name() string { return "system_gift" }

func (SystemGiftCreditClassifier) ListCredits(ctx context.Context, userID int, fromTs, toTs int64) ([]CreditEvent, error) {
	_ = ctx
	var logs []*model.Log
	q := model.LOG_DB.Model(&model.Log{}).
		Where("user_id = ? AND type = ? AND created_at < ?", userID, model.LogTypeSystem, toTs).
		Where("content LIKE ? OR content LIKE ?", "%注册赠送%", "%邀请码赠送%")
	if fromTs > 0 {
		q = q.Where("created_at >= ?", fromTs)
	}
	if err := q.Find(&logs).Error; err != nil {
		return nil, err
	}
	out := make([]CreditEvent, 0, len(logs))
	for _, l := range logs {
		quota := int64(0)
		if strings.Contains(l.Content, "新用户注册赠送") {
			quota = int64(common.QuotaForNewUser)
		} else if strings.Contains(l.Content, "使用邀请码赠送") {
			quota = int64(common.QuotaForInvitee)
		}
		if quota <= 0 {
			continue
		}
		out = append(out, CreditEvent{
			UserID:     userID,
			Quota:      quota,
			OccurredAt: l.CreatedAt,
			Source:     "system_gift",
			Kind:       CreditKindGift,
		})
	}
	return out, nil
}

// DefaultReplayer builds the production ledger replayer.
func DefaultReplayer() *LedgerReplayer {
	return &LedgerReplayer{
		Credits: []CreditClassifier{
			TopupCreditClassifier{},
			CheckinCreditClassifier{},
			RedemptionCreditClassifier{},
			SystemGiftCreditClassifier{},
		},
		Filters: []ConsumeFilter{
			ExcludeSubscriptionFilter{},
		},
		Consumes: LogConsumeLoader{},
	}
}

// LoadLocationOrShanghai returns Asia/Shanghai or a fixed +8 fallback.
func LoadLocationOrShanghai(name string) *time.Location {
	if name == "" {
		name = "Asia/Shanghai"
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}
