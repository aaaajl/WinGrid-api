package agensvideo

const ChannelName = "Agnes Video"

const (
	ModelAgnesVideoV20 = "agnes-video-v2.0"

	DefaultWidth     = 1152
	DefaultHeight    = 768
	DefaultFrameRate = 24.0
	DefaultSeconds   = 5
	MaxNumFrames     = 441
	MinFrameRate     = 1.0
	MaxFrameRate     = 60.0
)

var ModelList = []string{
	ModelAgnesVideoV20,
}
