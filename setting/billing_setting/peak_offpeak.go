package billing_setting

import (
	"github.com/QuantumNous/new-api/pkg/peakoffpeak"
)

const DefaultPeakOffPeakTimezone = peakoffpeak.DefaultTimezone

// PeakOffPeakConfig aliases the package type stored in options.
type PeakOffPeakConfig = peakoffpeak.Config

// ValidatePeakOffPeakConfig rejects invalid timezone / windows / prices.
func ValidatePeakOffPeakConfig(cfg PeakOffPeakConfig) error {
	return peakoffpeak.Validate(cfg)
}

// GetPeakOffPeakPricing returns the configured peak/off-peak card for a model.
func GetPeakOffPeakPricing(model string) (PeakOffPeakConfig, bool) {
	cfg, ok := billingSetting.PeakOffPeakPricing[model]
	if !ok {
		return PeakOffPeakConfig{}, false
	}
	return cfg, true
}

// GetPeakOffPeakPricingCopy returns a deep-ish copy of all peak/off-peak configs.
func GetPeakOffPeakPricingCopy() map[string]PeakOffPeakConfig {
	if len(billingSetting.PeakOffPeakPricing) == 0 {
		return map[string]PeakOffPeakConfig{}
	}
	out := make(map[string]PeakOffPeakConfig, len(billingSetting.PeakOffPeakPricing))
	for model, cfg := range billingSetting.PeakOffPeakPricing {
		copied := cfg
		if len(cfg.PeakWindows) > 0 {
			copied.PeakWindows = append([]peakoffpeak.TimeWindow(nil), cfg.PeakWindows...)
		}
		out[model] = copied
	}
	return out
}

// IsPeakOffPeakBilling reports whether the model uses peak_offpeak billing.
func IsPeakOffPeakBilling(model string) bool {
	return GetBillingMode(model) == BillingModePeakOffPeak
}
