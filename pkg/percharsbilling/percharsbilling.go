// Package percharsbilling implements per-10k-character pricing math for
// character-metered models such as TTS. It is intentionally stdlib-only so
// billing accuracy can be tested offline.
package percharsbilling

import (
	"fmt"
	"math"
	"unicode"
)

// CharsPerUnit is the pricing unit: the configured price covers 10,000 characters.
const CharsPerUnit = 10000

// MaxCharacters bounds a single request's billable character count so an
// absurd user or upstream value cannot inflate the charge. It matches the
// single-request int32 saturation boundary used by quota conversion.
const MaxCharacters = 1<<31 - 1

// Config is USD per 10,000 characters.
type Config struct {
	PricePer10KChars float64
}

// Validate rejects non-positive / non-finite prices.
func Validate(cfg Config) error {
	if cfg.PricePer10KChars <= 0 || math.IsNaN(cfg.PricePer10KChars) || math.IsInf(cfg.PricePer10KChars, 0) {
		return fmt.Errorf("price_per_10k_chars must be a finite positive number")
	}
	return nil
}

// CostUSD is the prorated dollar cost for the actual character count:
// characters / 10000 × price. Characters are clamped to MaxCharacters.
func CostUSD(cfg Config, characters int) (float64, error) {
	if characters < 0 {
		return 0, fmt.Errorf("characters must be >= 0")
	}
	if err := Validate(cfg); err != nil {
		return 0, err
	}
	billable := min(characters, MaxCharacters)
	return float64(billable) / CharsPerUnit * cfg.PricePer10KChars, nil
}

// EstimatedCharacters is the billable character count for request text, used
// to pre-charge before the upstream reports its authoritative count.
// The Qwen-Audio-TTS endpoint meters each Han ideograph as two characters
// (kana, hangul, fullwidth forms, and Latin count once), so the estimate
// applies the same weight. The result is clamped to MaxCharacters.
func EstimatedCharacters(text string) int {
	count := 0
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			count += 2
			continue
		}
		count++
	}
	return min(count, MaxCharacters)
}
