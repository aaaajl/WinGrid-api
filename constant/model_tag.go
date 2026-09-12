package constant

// Reserved model catalog tags for modality / playground routing.
const (
	ModelTagT2T = "t2t" // text-to-text (chat)
	ModelTagT2A = "t2a" // text-to-audio (speech synthesis)
	ModelTagT2I = "t2i" // text-to-image
	ModelTagT2V = "t2v" // text-to-video
	ModelTagI2V = "i2v" // image-to-video
	ModelTagR2V = "r2v" // reference / first-last frame to video
	ModelTagV2V = "v2v" // video edit
	ModelTagS2V = "s2v" // subject-reference to video
)

// ReservedModelTags lists catalog tags managed in the models table.
var ReservedModelTags = []string{
	ModelTagT2T,
	ModelTagT2A,
	ModelTagT2I,
	ModelTagT2V,
	ModelTagI2V,
	ModelTagR2V,
	ModelTagV2V,
	ModelTagS2V,
}
