package billing_setting

import "github.com/QuantumNous/new-api/pkg/durationbilling"

// DurationPriceConfig is USD-per-second pricing keyed by normalized size.
type DurationPriceConfig struct {
	FallbackPrice float64            `json:"fallback_price"`
	SizePrices    map[string]float64 `json:"size_prices"`
}

// ValidateDurationPricing rejects non-positive / non-finite prices.
func ValidateDurationPricing(cfg DurationPriceConfig) error {
	return durationbilling.Validate(durationbilling.Config{
		FallbackPrice: cfg.FallbackPrice,
		SizePrices:    cfg.SizePrices,
	})
}

// NormalizeSizeKey normalizes resolution/size labels for price-table lookup.
func NormalizeSizeKey(size string) string {
	return durationbilling.NormalizeSizeKey(size)
}

// LookupBasePrice returns the USD/second rate for a normalized size key.
func LookupBasePrice(cfg DurationPriceConfig, normalizedSize string) (basePrice float64, usedFallback bool) {
	return durationbilling.LookupBasePrice(durationbilling.Config{
		FallbackPrice: cfg.FallbackPrice,
		SizePrices:    cfg.SizePrices,
	}, normalizedSize)
}

// GetDurationPricing returns the configured per-duration price table for a model.
func GetDurationPricing(model string) (DurationPriceConfig, bool) {
	cfg, ok := billingSetting.DurationPricing[model]
	if !ok {
		return DurationPriceConfig{}, false
	}
	return cfg, true
}

// GetDurationPricingCopy returns a shallow copy of all duration pricing configs.
func GetDurationPricingCopy() map[string]DurationPriceConfig {
	if len(billingSetting.DurationPricing) == 0 {
		return map[string]DurationPriceConfig{}
	}
	out := make(map[string]DurationPriceConfig, len(billingSetting.DurationPricing))
	for model, cfg := range billingSetting.DurationPricing {
		copied := DurationPriceConfig{FallbackPrice: cfg.FallbackPrice}
		if len(cfg.SizePrices) > 0 {
			copied.SizePrices = make(map[string]float64, len(cfg.SizePrices))
			for k, v := range cfg.SizePrices {
				copied.SizePrices[k] = v
			}
		}
		out[model] = copied
	}
	return out
}

// IsPerDurationBilling reports whether the model uses per_duration billing.
func IsPerDurationBilling(model string) bool {
	return GetBillingMode(model) == BillingModePerDuration
}
