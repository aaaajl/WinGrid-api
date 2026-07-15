// Package durationbilling implements size×duration video pricing math.
// It is intentionally stdlib-only so billing accuracy can be tested offline.
package durationbilling

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

// Config is USD-per-second pricing keyed by normalized size.
type Config struct {
	FallbackPrice float64
	SizePrices    map[string]float64
}

var bareResolutionDigits = regexp.MustCompile(`(?i)^\d{3,4}$`)

// Validate rejects non-positive / non-finite prices.
func Validate(cfg Config) error {
	if err := validatePositiveFinitePrice(cfg.FallbackPrice, "fallback_price"); err != nil {
		return err
	}
	for size, price := range cfg.SizePrices {
		key := strings.TrimSpace(size)
		if key == "" {
			return fmt.Errorf("size_prices contains an empty size key")
		}
		if err := validatePositiveFinitePrice(price, "size_prices["+key+"]"); err != nil {
			return err
		}
	}
	return nil
}

func validatePositiveFinitePrice(price float64, field string) error {
	if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
		return fmt.Errorf("%s must be a finite positive number", field)
	}
	return nil
}

// NormalizeSizeKey normalizes resolution/size labels for price-table lookup.
// Examples: "720p" / "720" → "720P"; "4k" → "4K"; "1280x720" stays "1280X720".
func NormalizeSizeKey(size string) string {
	key := strings.ToUpper(strings.TrimSpace(size))
	if key == "" {
		return ""
	}
	if bareResolutionDigits.MatchString(key) {
		return key + "P"
	}
	if strings.HasSuffix(key, "P") {
		base := strings.TrimSuffix(key, "P")
		if bareResolutionDigits.MatchString(base) {
			return base + "P"
		}
	}
	return key
}

// LookupBasePrice returns the USD/second rate for a normalized size key.
// Empty / unknown size uses FallbackPrice. Map keys are matched after
// NormalizeSizeKey so "720p" in config hits requests normalized to "720P".
func LookupBasePrice(cfg Config, normalizedSize string) (basePrice float64, usedFallback bool) {
	if normalizedSize != "" {
		if price, ok := cfg.SizePrices[normalizedSize]; ok {
			return price, false
		}
		for key, price := range cfg.SizePrices {
			if NormalizeSizeKey(key) == normalizedSize {
				return price, false
			}
		}
	}
	return cfg.FallbackPrice, true
}

// CostUSD is the single-request dollar cost: basePrice(size) × duration.
func CostUSD(cfg Config, normalizedSize string, durationSeconds int) (cost float64, basePrice float64, usedFallback bool, err error) {
	if durationSeconds < 1 {
		return 0, 0, false, fmt.Errorf("duration must be >= 1")
	}
	if err := Validate(cfg); err != nil {
		return 0, 0, false, err
	}
	basePrice, usedFallback = LookupBasePrice(cfg, normalizedSize)
	return basePrice * float64(durationSeconds), basePrice, usedFallback, nil
}
