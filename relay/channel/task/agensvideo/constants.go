package agensvideo

const ChannelName = "Agnes Video"

const (
	ModelAgnesVideoV20 = "agnes-video-v2.0"
	ModelAgnesVideo25  = "agnes-video-2.5"

	DefaultWidth     = 1152
	DefaultHeight    = 768
	DefaultFrameRate = 24.0
	DefaultSeconds   = 5
	DefaultSizeV25   = "720P"
	DefaultRatioV25  = "16:9"
	MinSecondsV25    = 4
	MaxSecondsV25    = 12
	MaxNumFrames     = 441
	MinFrameRate     = 1.0
	MaxFrameRate     = 60.0
)

var ModelList = []string{
	ModelAgnesVideoV20,
	ModelAgnesVideo25,
}

var supportedSizesV25 = map[string]struct{}{
	"720P": {},
	"960P": {},
	"2K":   {},
}

var supportedAspectRatiosV25 = map[string]struct{}{
	"21:9": {},
	"16:9": {},
	"4:3":  {},
	"1:1":  {},
	"3:4":  {},
	"9:16": {},
}
