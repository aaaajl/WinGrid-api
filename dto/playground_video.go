package dto

type PlaygroundVideoModel struct {
	Model        string      `json:"model"`
	Tags         []string    `json:"tags"`
	Profile      string      `json:"profile"`
	Label        string      `json:"label"`
	Capabilities interface{} `json:"capabilities"`
}

type HappyHorseVideoCapabilities struct {
	SupportedSizes []string `json:"supported_sizes"`
	DurationRange  [2]int   `json:"duration_range"`
	Fields         []string `json:"fields"`
}

type SeedanceVideoCapabilities struct {
	SupportedResolutions []string `json:"supported_resolutions"`
	SupportedRatios      []string `json:"supported_ratios"`
	DurationRange        [2]int   `json:"duration_range"`
	Fields               []string `json:"fields"`
}

type GenericVideoCapabilities struct {
	SupportedSizes []string `json:"supported_sizes"`
	DurationRange  [2]int   `json:"duration_range"`
	Fields         []string `json:"fields"`
	Form           string   `json:"form"`
}

type MiniMaxH3VideoCapabilities struct {
	SupportedResolutions []string `json:"supported_resolutions"`
	SupportedRatios      []string `json:"supported_ratios"`
	DurationRange        [2]int   `json:"duration_range"`
	Fields               []string `json:"fields"`
	Form                 string   `json:"form"`
}
