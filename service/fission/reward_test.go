package fission

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalculateReward(t *testing.T) {
	t.Parallel()

	r := CalculateReward(RewardInput{BaseCNY: 100, Rate: 0.03, MinCNY: 10})
	assert.True(t, r.Skipped)
	assert.Equal(t, 0.0, r.PayCNY)

	r = CalculateReward(RewardInput{BaseCNY: 100, Rate: 0.2, MinCNY: 10})
	assert.False(t, r.Skipped)
	assert.InDelta(t, 20.0, r.PayCNY, 0.001)

	r = CalculateReward(RewardInput{BaseCNY: 400, Rate: 0.03, MinCNY: 10})
	assert.False(t, r.Skipped)
	assert.InDelta(t, 12.0, r.PayCNY, 0.001)
}

func TestCalculateRewardSkipsInvalid(t *testing.T) {
	t.Parallel()
	r := CalculateReward(RewardInput{BaseCNY: 0, Rate: 0.03, MinCNY: 10})
	assert.True(t, r.Skipped)
}

func TestLedgerReplayerGiftFirst(t *testing.T) {
	t.Parallel()
	credits := []CreditEvent{
		{UserID: 1, Quota: 100, OccurredAt: 10, Kind: CreditKindGift, Source: "gift"},
		{UserID: 1, Quota: 100, OccurredAt: 20, Kind: CreditKindPaid, Source: "topup"},
	}
	consumes := []ConsumeEvent{
		{UserID: 1, Quota: 150, OccurredAt: 30, BillingSource: "wallet"},
	}

	r := &LedgerReplayer{
		Credits:  []CreditClassifier{staticCredits{credits}},
		Filters:  []ConsumeFilter{ExcludeSubscriptionFilter{}},
		Consumes: staticConsumes{consumes},
	}
	res, err := r.ReplayWindow(context.Background(), 1, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, int64(50), res.EligibleQuota)
	assert.Equal(t, int64(100), res.GiftConsumedQuota)
}

func TestLedgerReplayerUncoveredCountsAsEligible(t *testing.T) {
	t.Parallel()
	// No credit records but wallet consume exists — still commissionable after gifts.
	r := &LedgerReplayer{
		Credits:  []CreditClassifier{staticCredits{}},
		Filters:  []ConsumeFilter{ExcludeSubscriptionFilter{}},
		Consumes: staticConsumes{[]ConsumeEvent{
			{UserID: 1, Quota: 80, OccurredAt: 30, BillingSource: "wallet"},
		}},
	}
	res, err := r.ReplayWindow(context.Background(), 1, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, int64(80), res.EligibleQuota)
}

func TestLedgerReplayerGiftOnlyPartial(t *testing.T) {
	t.Parallel()
	r := &LedgerReplayer{
		Credits: []CreditClassifier{staticCredits{[]CreditEvent{
			{UserID: 1, Quota: 30, OccurredAt: 10, Kind: CreditKindGift},
		}}},
		Filters: []ConsumeFilter{ExcludeSubscriptionFilter{}},
		Consumes: staticConsumes{[]ConsumeEvent{
			{UserID: 1, Quota: 100, OccurredAt: 20, BillingSource: "wallet"},
		}},
	}
	res, err := r.ReplayWindow(context.Background(), 1, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, int64(70), res.EligibleQuota)
	assert.Equal(t, int64(30), res.GiftConsumedQuota)
}

func TestLedgerReplayerExcludesSubscription(t *testing.T) {
	t.Parallel()
	r := &LedgerReplayer{
		Credits: []CreditClassifier{staticCredits{[]CreditEvent{
			{UserID: 1, Quota: 100, OccurredAt: 10, Kind: CreditKindPaid},
		}}},
		Filters: []ConsumeFilter{ExcludeSubscriptionFilter{}},
		Consumes: staticConsumes{[]ConsumeEvent{
			{UserID: 1, Quota: 80, OccurredAt: 20, BillingSource: "subscription"},
			{UserID: 1, Quota: 20, OccurredAt: 21, BillingSource: "wallet"},
		}},
	}
	res, err := r.ReplayWindow(context.Background(), 1, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, int64(20), res.EligibleQuota)
}

func TestQuotaToCNYCents(t *testing.T) {
	t.Parallel()
	assert.Equal(t, int64(700), QuotaToCNYCents(500000, 500000, 7))
}

func TestResolveAsOfDateHistoricalMonth(t *testing.T) {
	t.Parallel()
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2026, 7, 22, 12, 0, 0, 0, loc)

	period, asOf, start, end, err := ResolveAsOfDate("2026-06", "", now)
	require.NoError(t, err)
	assert.Equal(t, "2026-06", period)
	assert.Equal(t, "2026-06-30", asOf)
	assert.True(t, end > start)

	period, asOf, _, _, err = ResolveAsOfDate("2026-07", "", now)
	require.NoError(t, err)
	assert.Equal(t, "2026-07", period)
	assert.Equal(t, "2026-07-21", asOf) // yesterday
}

func TestResolveAsOfDateFutureMonth(t *testing.T) {
	t.Parallel()
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2026, 7, 22, 12, 0, 0, 0, loc)
	_, _, _, _, err := ResolveAsOfDate("2026-08", "", now)
	require.Error(t, err)
}

type staticCredits struct{ events []CreditEvent }

func (s staticCredits) Name() string { return "static" }
func (s staticCredits) ListCredits(_ context.Context, _ int, _, _ int64) ([]CreditEvent, error) {
	return s.events, nil
}

type staticConsumes struct{ events []ConsumeEvent }

func (s staticConsumes) Name() string { return "static" }
func (s staticConsumes) ListConsumes(_ context.Context, _ int, _, _ int64) ([]ConsumeEvent, error) {
	return s.events, nil
}
