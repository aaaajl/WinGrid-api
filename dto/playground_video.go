package dto

type PlaygroundVideoModel struct {
	Model        string      `json:"model"`
	Tags         []string    `json:"tags"`
	Groups       []string    `json:"groups"`
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

type AgnesVideoCapabilities struct {
	SupportedSizes  []string   `json:"supported_sizes"`
	SupportedRatios []string   `json:"supported_ratios"`
	DurationRange   [2]int     `json:"duration_range"`
	FrameRateRange  [2]float64 `json:"frame_rate_range,omitempty"`
	NumFramesRange  [2]int     `json:"num_frames_range,omitempty"`
	Fields          []string   `json:"fields"`
	Form            string     `json:"form"`
}

type Wan30VideoCapabilities struct {
	SupportedResolutions []string `json:"supported_resolutions"`
	SupportedRatios      []string `json:"supported_ratios"`
	DurationRange        [2]int   `json:"duration_range"`
	SmartDuration        bool     `json:"smart_duration"`
	MediaTypes           []string `json:"media_types"`
	Modes                []string `json:"modes"`
	Fields               []string `json:"fields"`
	Form                 string   `json:"form"`
}
