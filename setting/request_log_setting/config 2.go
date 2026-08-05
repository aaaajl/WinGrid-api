package request_log_setting

import "github.com/QuantumNous/new-api/setting/config"

type RequestLogSetting struct {
	Enabled        bool   `json:"enabled"`
	MaxBodyKB      int    `json:"max_body_kb"`
	RetentionDays  int    `json:"retention_days"`
	StoreHeaders   bool   `json:"store_headers"`
	RedactHeaders  string `json:"redact_headers"`
}

var requestLogSetting = RequestLogSetting{
	Enabled:       false,
	MaxBodyKB:     1024,
	RetentionDays: 7,
	StoreHeaders:  true,
	RedactHeaders: "Authorization,Cookie,x-api-key,x-goog-api-key",
}

func init() {
	config.GlobalConfig.Register("request_log_setting", &requestLogSetting)
}

func GetSetting() RequestLogSetting {
	return requestLogSetting
}
