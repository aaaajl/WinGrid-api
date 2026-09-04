package dto

type PlaygroundImageModel struct {
	Model        string            `json:"model"`
	Tags         []string          `json:"tags"`
	Groups       []string          `json:"groups"`
	Profile      string            `json:"profile"`
	Label        string            `json:"label"`
	Capabilities ImageCapabilities `json:"capabilities"`
}

type ImageCapabilities struct {
	SupportedSizes []string `json:"supported_sizes"`
	NRange         [2]int   `json:"n_range"`
	Fields         []string `json:"fields"`
}
