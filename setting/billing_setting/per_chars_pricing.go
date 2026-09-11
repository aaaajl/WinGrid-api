package billing_setting

import (
	"maps"

	"github.com/QuantumNous/new-api/pkg/percharsbilling"
)

// PerCharsPriceConfig is USD per 10,000 characters.
type PerCharsPriceConfig struct {
	PricePer10KChars float64 `json:"price_per_10k_chars"`
}

// ValidatePerCharsPricing rejects non-positive / non-finite prices.
func ValidatePerCharsPricing(cfg PerCharsPriceConfig) error {
	return percharsbilling.Validate(percharsbilling.Config{PricePer10KChars: cfg.PricePer10KChars})
}

// GetPerCharsPricing returns the configured per-character price for a model.
func GetPerCharsPricing(model string) (PerCharsPriceConfig, bool) {
	cfg, ok := billingSetting.PerCharsPricing[model]
	if !ok {
		return PerCharsPriceConfig{}, false
	}
	return cfg, true
}

// GetPerCharsPricingCopy returns a shallow copy of all per-character pricing configs.
func GetPerCharsPricingCopy() map[string]PerCharsPriceConfig {
	if len(billingSetting.PerCharsPricing) == 0 {
		return map[string]PerCharsPriceConfig{}
	}
	out := make(map[string]PerCharsPriceConfig, len(billingSetting.PerCharsPricing))
	maps.Copy(out, billingSetting.PerCharsPricing)
	return out
}

// IsPerCharsBilling reports whether the model uses per_chars billing.
func IsPerCharsBilling(model string) bool {
	return GetBillingMode(model) == BillingModePerChars
}
