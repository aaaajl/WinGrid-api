// Package peakoffpeak implements peak / off-peak token pricing math.
// It is intentionally stdlib-only so billing accuracy can be tested offline.
package peakoffpeak

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

const (
	PeriodPeak    = "peak"
	PeriodOffPeak = "off_peak"

	DefaultTimezone = "Asia/Shanghai"

	BillingMode = "peak_offpeak"
)

// TimeWindow is a half-open daily window [Start, End) in HH:mm local time.
// When Start > End the window crosses midnight.
type TimeWindow struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// TokenPrices is USD per 1M tokens for one period.
type TokenPrices struct {
	CacheHit   float64  `json:"cache_hit"`
	CacheMiss  float64  `json:"cache_miss"`
	Completion float64  `json:"completion"`
	CacheCreation *float64 `json:"cache_creation,omitempty"`
	Image         *float64 `json:"image,omitempty"`
	AudioIn       *float64 `json:"audio_in,omitempty"`
	AudioOut      *float64 `json:"audio_out,omitempty"`
}

// Config is the full peak/off-peak pricing contract for one model.
type Config struct {
	Timezone     string      `json:"timezone"`
	WeekdaysOnly bool        `json:"weekdays_only"`
	PeakWindows  []TimeWindow `json:"peak_windows"`
	Peak         TokenPrices `json:"peak"`
	OffPeak      TokenPrices `json:"off_peak"`
}

// TokenParams are billing token counts after usage normalization.
type TokenParams struct {
	P    float64 // cache-miss / text input remainder
	CR   float64 // cache hit
	C    float64 // completion
	CC   float64 // cache creation (optional)
	Img  float64
	AI   float64
	AO   float64
}

// Snapshot freezes config + eval clock at pre-consume.
type Snapshot struct {
	BillingMode              string  `json:"billing_mode"`
	ModelName                string  `json:"model_name"`
	Config                   Config  `json:"config"`
	ConfigHash               string  `json:"config_hash"`
	EvalUnix                 int64   `json:"eval_unix"`
	EstimatedPeriod          string  `json:"estimated_period"`
	GroupRatio               float64 `json:"group_ratio"`
	QuotaPerUnit             float64 `json:"quota_per_unit"`
	EstimatedQuotaBeforeGroup float64 `json:"estimated_quota_before_group"`
	EstimatedQuotaAfterGroup int     `json:"estimated_quota_after_group"`
	EstimatedPromptTokens    int     `json:"estimated_prompt_tokens"`
	EstimatedCompletionTokens int    `json:"estimated_completion_tokens"`
}

// Result is settlement output.
type Result struct {
	ActualQuotaBeforeGroup float64
	ActualQuotaAfterGroup  int
	MatchedPeriod          string
	CostUSD                float64
}

// Validate rejects invalid timezone, windows, or non-positive prices.
func Validate(cfg Config) error {
	tz := strings.TrimSpace(cfg.Timezone)
	if tz == "" {
		return fmt.Errorf("timezone is required")
	}
	if _, err := time.LoadLocation(tz); err != nil {
		return fmt.Errorf("invalid timezone %q: %w", tz, err)
	}
	if len(cfg.PeakWindows) < 1 {
		return fmt.Errorf("peak_windows must contain at least one window")
	}
	parsed := make([][2]int, 0, len(cfg.PeakWindows))
	for i, w := range cfg.PeakWindows {
		start, err := parseHHMM(w.Start)
		if err != nil {
			return fmt.Errorf("peak_windows[%d].start: %w", i, err)
		}
		end, err := parseHHMM(w.End)
		if err != nil {
			return fmt.Errorf("peak_windows[%d].end: %w", i, err)
		}
		if start == end {
			return fmt.Errorf("peak_windows[%d]: start and end must differ", i)
		}
		parsed = append(parsed, [2]int{start, end})
	}
	if err := checkWindowOverlap(parsed); err != nil {
		return err
	}
	if err := validateTokenPrices(cfg.Peak, "peak"); err != nil {
		return err
	}
	if err := validateTokenPrices(cfg.OffPeak, "off_peak"); err != nil {
		return err
	}
	return nil
}

func validateTokenPrices(p TokenPrices, label string) error {
	if err := validatePositiveFinite(p.CacheHit, label+".cache_hit"); err != nil {
		return err
	}
	if err := validatePositiveFinite(p.CacheMiss, label+".cache_miss"); err != nil {
		return err
	}
	if err := validatePositiveFinite(p.Completion, label+".completion"); err != nil {
		return err
	}
	for name, ptr := range map[string]*float64{
		label + ".cache_creation": p.CacheCreation,
		label + ".image":          p.Image,
		label + ".audio_in":       p.AudioIn,
		label + ".audio_out":      p.AudioOut,
	} {
		if ptr == nil {
			continue
		}
		if err := validatePositiveFinite(*ptr, name); err != nil {
			return err
		}
	}
	return nil
}

func validatePositiveFinite(v float64, field string) error {
	if v <= 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Errorf("%s must be a finite positive number", field)
	}
	return nil
}

func parseHHMM(s string) (int, error) {
	s = strings.TrimSpace(s)
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid HH:mm %q", s)
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return 0, fmt.Errorf("invalid hour in %q", s)
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return 0, fmt.Errorf("invalid minute in %q", s)
	}
	return h*60 + m, nil
}

// checkWindowOverlap expands each window onto a 1440-minute bitset.
func checkWindowOverlap(windows [][2]int) error {
	occupied := make([]bool, 1440)
	for i, w := range windows {
		start, end := w[0], w[1]
		var minutes []int
		if start < end {
			for t := start; t < end; t++ {
				minutes = append(minutes, t)
			}
		} else {
			for t := start; t < 1440; t++ {
				minutes = append(minutes, t)
			}
			for t := 0; t < end; t++ {
				minutes = append(minutes, t)
			}
		}
		for _, t := range minutes {
			if occupied[t] {
				return fmt.Errorf("peak_windows[%d] overlaps another window", i)
			}
			occupied[t] = true
		}
	}
	return nil
}

// ResolvePeriod returns peak or off_peak for evalAt under cfg.
// Invalid timezone returns an error (never silently falls back to UTC).
func ResolvePeriod(cfg Config, evalAt time.Time) (string, error) {
	tz := strings.TrimSpace(cfg.Timezone)
	if tz == "" {
		tz = DefaultTimezone
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return "", fmt.Errorf("invalid timezone %q: %w", tz, err)
	}
	local := evalAt.In(loc)
	if cfg.WeekdaysOnly {
		wd := local.Weekday()
		if wd == time.Saturday || wd == time.Sunday {
			return PeriodOffPeak, nil
		}
	}
	tod := local.Hour()*60 + local.Minute()
	for _, w := range cfg.PeakWindows {
		start, err := parseHHMM(w.Start)
		if err != nil {
			return "", err
		}
		end, err := parseHHMM(w.End)
		if err != nil {
			return "", err
		}
		if inWindow(tod, start, end) {
			return PeriodPeak, nil
		}
	}
	return PeriodOffPeak, nil
}

func inWindow(tod, start, end int) bool {
	if start < end {
		return tod >= start && tod < end
	}
	// Cross-midnight: [start, 1440) U [0, end)
	return tod >= start || tod < end
}

// PricesForPeriod selects the price table for a period.
func PricesForPeriod(cfg Config, period string) TokenPrices {
	if period == PeriodPeak {
		return cfg.Peak
	}
	return cfg.OffPeak
}

// CalcCostUSD computes dollar cost from token counts and a price table.
// Coefficients are $/1M tokens.
func CalcCostUSD(prices TokenPrices, tokens TokenParams) float64 {
	cost := tokens.P*prices.CacheMiss +
		tokens.CR*prices.CacheHit +
		tokens.C*prices.Completion
	if prices.CacheCreation != nil {
		cost += tokens.CC * *prices.CacheCreation
	}
	if prices.Image != nil {
		cost += tokens.Img * *prices.Image
	}
	if prices.AudioIn != nil {
		cost += tokens.AI * *prices.AudioIn
	}
	if prices.AudioOut != nil {
		cost += tokens.AO * *prices.AudioOut
	}
	return cost / 1_000_000
}

// ConfigHash returns a stable hash of the config JSON for audit.
func ConfigHash(cfg Config) string {
	b, err := json.Marshal(cfg)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum)
}

// DeepSeekV4FlashPreset is the official DeepSeek V4 Flash peak/off-peak card
// expressed in Asia/Shanghai windows.
func DeepSeekV4FlashPreset() Config {
	return Config{
		Timezone:     DefaultTimezone,
		WeekdaysOnly: true,
		PeakWindows: []TimeWindow{
			{Start: "09:00", End: "12:00"},
			{Start: "14:00", End: "18:00"},
		},
		Peak: TokenPrices{
			CacheHit: 0.014, CacheMiss: 0.44, Completion: 1.32,
		},
		OffPeak: TokenPrices{
			CacheHit: 0.007, CacheMiss: 0.22, Completion: 0.66,
		},
	}
}

// DeepSeekV4ProPreset is the official DeepSeek V4 Pro card.
func DeepSeekV4ProPreset() Config {
	return Config{
		Timezone:     DefaultTimezone,
		WeekdaysOnly: true,
		PeakWindows: []TimeWindow{
			{Start: "09:00", End: "12:00"},
			{Start: "14:00", End: "18:00"},
		},
		Peak: TokenPrices{
			CacheHit: 0.044, CacheMiss: 1.32, Completion: 3.96,
		},
		OffPeak: TokenPrices{
			CacheHit: 0.022, CacheMiss: 0.66, Completion: 1.98,
		},
	}
}
