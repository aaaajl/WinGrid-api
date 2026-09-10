package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/peakoffpeak"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTryPeakOffPeakSettle_FrozenClock(t *testing.T) {
	common.QuotaPerUnit = 500000
	cfg := peakoffpeak.DeepSeekV4FlashPreset()
	loc, err := time.LoadLocation(peakoffpeak.DefaultTimezone)
	require.NoError(t, err)
	// Peak: Mon 10:00 Asia/Shanghai
	evalAt := time.Date(2026, 8, 17, 10, 0, 0, 0, loc)

	snap := &peakoffpeak.Snapshot{
		BillingMode:  billing_setting.BillingModePeakOffPeak,
		ModelName:    "deepseek-v4-flash",
		Config:       cfg,
		EvalUnix:     evalAt.Unix(),
		GroupRatio:   1,
		QuotaPerUnit: common.QuotaPerUnit,
	}
	info := &relaycommon.RelayInfo{PeakOffPeakSnapshot: snap}

	usage := &dto.Usage{
		PromptTokens:     1_000_000,
		CompletionTokens: 1_000_000,
	}
	ok, quota, result := TryPeakOffPeakSettle(info, usage, false)
	require.True(t, ok)
	require.NotNil(t, result)
	assert.Equal(t, peakoffpeak.PeriodPeak, result.MatchedPeriod)
	assert.InDelta(t, 1.76, result.CostUSD, 1e-9)
	// 1.76 * 500000 = 880000
	assert.Equal(t, 880000, quota)

	// Same tokens but if EvalUnix were noon (off-peak), cost halves — prove we do NOT use Now().
	snap.EvalUnix = time.Date(2026, 8, 17, 13, 0, 0, 0, loc).Unix()
	ok, quota, result = TryPeakOffPeakSettle(info, usage, false)
	require.True(t, ok)
	assert.Equal(t, peakoffpeak.PeriodOffPeak, result.MatchedPeriod)
	assert.InDelta(t, 0.88, result.CostUSD, 1e-9)
	assert.Equal(t, 440000, quota)
}

func TestTryPeakOffPeakSettle_WeekendOffPeak(t *testing.T) {
	common.QuotaPerUnit = 500000
	cfg := peakoffpeak.DeepSeekV4FlashPreset()
	loc, err := time.LoadLocation(peakoffpeak.DefaultTimezone)
	require.NoError(t, err)
	// Saturday 10:00 — clock is in peak window but weekdays_only forces off_peak
	evalAt := time.Date(2026, 8, 22, 10, 0, 0, 0, loc)
	info := &relaycommon.RelayInfo{
		PeakOffPeakSnapshot: &peakoffpeak.Snapshot{
			BillingMode:  billing_setting.BillingModePeakOffPeak,
			Config:       cfg,
			EvalUnix:     evalAt.Unix(),
			GroupRatio:   1,
			QuotaPerUnit: common.QuotaPerUnit,
		},
	}
	ok, _, result := TryPeakOffPeakSettle(info, &dto.Usage{PromptTokens: 1_000_000, CompletionTokens: 1_000_000}, false)
	require.True(t, ok)
	assert.Equal(t, peakoffpeak.PeriodOffPeak, result.MatchedPeriod)
}

func TestTryPeakOffPeakSettle_NotApplicable(t *testing.T) {
	ok, _, _ := TryPeakOffPeakSettle(&relaycommon.RelayInfo{}, &dto.Usage{}, false)
	assert.False(t, ok)
}

func TestBuildPeakOffPeakTokenParams_SubtractsCache(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     1000,
		CompletionTokens: 100,
	}
	usage.PromptTokensDetails.CachedTokens = 200
	params := BuildPeakOffPeakTokenParams(usage, false)
	assert.Equal(t, float64(800), params.P)
	assert.Equal(t, float64(200), params.CR)
	assert.Equal(t, float64(100), params.C)
}
