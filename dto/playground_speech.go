package dto

type PlaygroundSpeechModel struct {
	Model        string             `json:"model"`
	Tags         []string           `json:"tags"`
	Groups       []string           `json:"groups"`
	Profile      string             `json:"profile"`
	Label        string             `json:"label"`
	Capabilities SpeechCapabilities `json:"capabilities"`
}

type SpeechCapabilities struct {
	Voices          []string   `json:"voices"`
	ResponseFormats []string   `json:"response_formats"`
	SpeedRange      [2]float64 `json:"speed_range"`
	Fields          []string   `json:"fields"`
	// AllowCustomVoice reports that the provider accepts voice ids beyond
	// Voices (for example DashScope's cloned voices), so the playground must
	// offer a select-or-type control instead of a closed list.
	AllowCustomVoice bool `json:"allow_custom_voice"`
}
