package peakoffpeak

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func deepSeekFlash() Config {
	return DeepSeekV4FlashPreset()
}

func shanghai(year int, month time.Month, day, hour, min, sec int) time.Time {
	loc, err := time.LoadLocation(DefaultTimezone)
	if err != nil {
		panic(err)
	}
	return time.Date(year, month, day, hour, min, sec, 0, loc)
}

func TestResolvePeriod_DeepSeekBoundaries(t *testing.T) {
	cfg := deepSeekFlash()
	// Monday 2026-08-17
	cases := []struct {
		name   string
		at     time.Time
		period string
	}{
		{"before morning", shanghai(2026, 8, 17, 8, 59, 59), PeriodOffPeak},
		{"morning start", shanghai(2026, 8, 17, 9, 0, 0), PeriodPeak},
		{"morning end-1", shanghai(2026, 8, 17, 11, 59, 59), PeriodPeak},
		{"noon", shanghai(2026, 8, 17, 12, 0, 0), PeriodOffPeak},
		{"before afternoon", shanghai(2026, 8, 17, 13, 59, 59), PeriodOffPeak},
		{"afternoon start", shanghai(2026, 8, 17, 14, 0, 0), PeriodPeak},
		{"afternoon end-1", shanghai(2026, 8, 17, 17, 59, 59), PeriodPeak},
		{"evening", shanghai(2026, 8, 17, 18, 0, 0), PeriodOffPeak},
		{"saturday morning clock", shanghai(2026, 8, 22, 10, 0, 0), PeriodOffPeak},
		{"sunday afternoon clock", shanghai(2026, 8, 23, 16, 0, 0), PeriodOffPeak},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ResolvePeriod(cfg, tc.at)
			require.NoError(t, err)
			assert.Equal(t, tc.period, got)
		})
	}
}

func TestResolvePeriod_WeekdaysOnlyDisabled(t *testing.T) {
	cfg := deepSeekFlash()
	cfg.WeekdaysOnly = false
	got, err := ResolvePeriod(cfg, shanghai(2026, 8, 22, 10, 0, 0)) // Saturday
	require.NoError(t, err)
	assert.Equal(t, PeriodPeak, got)
}

func TestResolvePeriod_CustomWindows(t *testing.T) {
	cfg := deepSeekFlash()
	cfg.PeakWindows = []TimeWindow{{Start: "10:00", End: "13:00"}}
	off, err := ResolvePeriod(cfg, shanghai(2026, 8, 17, 9, 30, 0))
	require.NoError(t, err)
	assert.Equal(t, PeriodOffPeak, off)
	peak, err := ResolvePeriod(cfg, shanghai(2026, 8, 17, 10, 30, 0))
	require.NoError(t, err)
	assert.Equal(t, PeriodPeak, peak)
}

func TestResolvePeriod_CrossMidnight(t *testing.T) {
	cfg := Config{
		Timezone:     DefaultTimezone,
		WeekdaysOnly: false,
		PeakWindows:  []TimeWindow{{Start: "22:00", End: "06:00"}},
		Peak:         TokenPrices{CacheHit: 1, CacheMiss: 1, Completion: 1},
		OffPeak:      TokenPrices{CacheHit: 1, CacheMiss: 1, Completion: 1},
	}
	require.NoError(t, Validate(cfg))
	peak, err := ResolvePeriod(cfg, shanghai(2026, 8, 17, 23, 0, 0))
	require.NoError(t, err)
	assert.Equal(t, PeriodPeak, peak)
	off, err := ResolvePeriod(cfg, shanghai(2026, 8, 17, 12, 0, 0))
	require.NoError(t, err)
	assert.Equal(t, PeriodOffPeak, off)
}

func TestResolvePeriod_InvalidTimezone(t *testing.T) {
	cfg := deepSeekFlash()
	cfg.Timezone = "Not/AZone"
	_, err := ResolvePeriod(cfg, time.Now())
	require.Error(t, err)
}

func TestValidate_Overlap(t *testing.T) {
	cfg := deepSeekFlash()
	cfg.PeakWindows = []TimeWindow{
		{Start: "09:00", End: "12:00"},
		{Start: "11:00", End: "15:00"},
	}
	require.Error(t, Validate(cfg))
}

func TestValidate_BadPrice(t *testing.T) {
	cfg := deepSeekFlash()
	cfg.Peak.CacheMiss = 0
	require.Error(t, Validate(cfg))
}

func TestCalcCostUSD_FlashAcceptance(t *testing.T) {
	cfg := deepSeekFlash()
	tokens := TokenParams{P: 1_000_000, C: 1_000_000}
	peakCost := CalcCostUSD(cfg.Peak, tokens)
	offCost := CalcCostUSD(cfg.OffPeak, tokens)
	assert.InDelta(t, 1.76, peakCost, 1e-9)
	assert.InDelta(t, 0.88, offCost, 1e-9)
	assert.InDelta(t, peakCost/2, offCost, 1e-9)

	cachePeak := CalcCostUSD(cfg.Peak, TokenParams{CR: 1_000_000})
	cacheOff := CalcCostUSD(cfg.OffPeak, TokenParams{CR: 1_000_000})
	assert.InDelta(t, 0.014, cachePeak, 1e-9)
	assert.InDelta(t, 0.007, cacheOff, 1e-9)
}

func TestCalcCostUSD_ProAcceptance(t *testing.T) {
	cfg := DeepSeekV4ProPreset()
	tokens := TokenParams{P: 1_000_000, C: 1_000_000}
	assert.InDelta(t, 5.28, CalcCostUSD(cfg.Peak, tokens), 1e-9)
	assert.InDelta(t, 2.64, CalcCostUSD(cfg.OffPeak, tokens), 1e-9)
}

func TestResolvePeriod_UsesConfigNotHardcoded(t *testing.T) {
	// Ensure DeepSeek morning window is not hard-wired when config differs.
	cfg := deepSeekFlash()
	cfg.PeakWindows = []TimeWindow{{Start: "01:00", End: "02:00"}}
	got, err := ResolvePeriod(cfg, shanghai(2026, 8, 17, 9, 30, 0))
	require.NoError(t, err)
	assert.Equal(t, PeriodOffPeak, got)
}
