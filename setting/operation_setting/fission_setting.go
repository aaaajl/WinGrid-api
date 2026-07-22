package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// FissionSetting controls invite fission cashback report behaviour.
type FissionSetting struct {
	Enabled      bool    `json:"enabled"`
	DefaultRate  float64 `json:"default_rate"`
	MinPayoutCNY float64 `json:"min_payout_cny"`
	Timezone     string  `json:"timezone"`
	StartPeriod  string  `json:"start_period"` // YYYY-MM inclusive
}

var fissionSetting = FissionSetting{
	Enabled:      true,
	DefaultRate:  0.03,
	MinPayoutCNY: 10,
	Timezone:     "Asia/Shanghai",
	StartPeriod:  "2026-06",
}

func init() {
	config.GlobalConfig.Register("fission_setting", &fissionSetting)
}

func GetFissionSetting() *FissionSetting {
	return &fissionSetting
}
