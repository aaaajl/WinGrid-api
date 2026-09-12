package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	SpeechProfileOpenAI  = "openai"
	SpeechProfileQwen    = "qwen"
	SpeechProfileMiniMax = "minimax"
	SpeechProfileGeneric = "generic"
)

// SpeechRequestProfile maps a model name to its playground speech request profile.
func SpeechRequestProfile(modelName string) string {
	lower := strings.ToLower(modelName)
	switch {
	case strings.Contains(lower, "qwen"):
		return SpeechProfileQwen
	case strings.Contains(lower, "minimax"):
		return SpeechProfileMiniMax
	case strings.Contains(lower, "tts"):
		return SpeechProfileOpenAI
	default:
		return SpeechProfileGeneric
	}
}

func openAISpeechCapabilities() dto.SpeechCapabilities {
	return dto.SpeechCapabilities{
		Voices:          []string{"alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"},
		ResponseFormats: []string{"mp3", "opus", "aac", "flac", "wav", "pcm"},
		SpeedRange:      [2]float64{0.25, 4},
		Fields:          []string{"voice", "response_format", "speed", "instructions"},
	}
}

// qwenAudioTTSSystemVoices returns the DashScope system voices a
// Qwen-Audio-TTS model accepts. Voices are scoped to a single model: sending a
// voice owned by another model fails upstream with
// "[cosyvoice:]Engine error [411]: TTS speak operation failed", so the lists
// must not be merged. longanhuan_v3.6 works on both known models and is the
// default the relay applies, so it is listed first.
func qwenAudioTTSSystemVoices(modelName string) []string {
	lower := strings.ToLower(modelName)
	switch {
	case strings.HasPrefix(lower, "qwen-audio-3.0-tts-flash"):
		return []string{
			"longanhuan_v3.6",
			"longanfengyue",
			"longanyuanfei",
			"longanlingxi",
			"longanxiaoxin",
			"longjielidou_v3.6",
			"longpaopao_v3.6",
			"longhuohuo_v3.6",
			"longchuanshu_v3.6",
			"loongmary",
			"loongeva_v3.6",
			"loongjohn",
		}
	case strings.HasPrefix(lower, "qwen-audio-3.0-tts-plus"):
		return []string{
			"longanhuan_v3.6",
			"longanlingxi",
			"longanlingxin",
			"longanlufeng",
		}
	default:
		// Unknown Qwen-Audio-TTS revision: voices change between releases, so
		// expose no list and rely on the typed-voice fallback.
		return []string{}
	}
}

// qwenSpeechCapabilities intentionally omits instructions: DashScope's
// non-realtime SpeechSynthesizer endpoint only supports instruction control for
// CosyVoice and the Qwen-TTS-Instruct-Flash series, not Qwen-Audio-TTS.
func qwenSpeechCapabilities(modelName string) dto.SpeechCapabilities {
	return dto.SpeechCapabilities{
		Voices:           qwenAudioTTSSystemVoices(modelName),
		ResponseFormats:  []string{},
		Fields:           []string{"voice"},
		AllowCustomVoice: true,
	}
}

func miniMaxSpeechCapabilities() dto.SpeechCapabilities {
	return dto.SpeechCapabilities{
		Voices:           []string{},
		ResponseFormats:  []string{"mp3", "wav", "flac", "aac", "pcm"},
		SpeedRange:       [2]float64{0.5, 2},
		Fields:           []string{"voice", "response_format", "speed"},
		AllowCustomVoice: true,
	}
}

func genericSpeechCapabilities() dto.SpeechCapabilities {
	return dto.SpeechCapabilities{
		Voices:          []string{"alloy", "echo", "fable", "onyx", "nova", "shimmer"},
		ResponseFormats: []string{"mp3", "opus", "aac", "flac", "wav", "pcm"},
		SpeedRange:      [2]float64{0.25, 4},
		Fields:          []string{"voice", "response_format", "speed", "instructions"},
	}
}

func speechCapabilitiesForModel(modelName, profile string) dto.SpeechCapabilities {
	switch profile {
	case SpeechProfileOpenAI:
		return openAISpeechCapabilities()
	case SpeechProfileQwen:
		return qwenSpeechCapabilities(modelName)
	case SpeechProfileMiniMax:
		return miniMaxSpeechCapabilities()
	default:
		return genericSpeechCapabilities()
	}
}

// ListPlaygroundSpeechModels returns catalog-backed t2a models available via the user's usable groups.
func ListPlaygroundSpeechModels(group string) ([]dto.PlaygroundSpeechModel, error) {
	enabled, modelGroups := GetUserUsableEnabledModelGroups(group)
	if len(enabled) == 0 {
		return []dto.PlaygroundSpeechModel{}, nil
	}

	catalog, err := model.GetEnabledCatalogModelsByNames(enabled)
	if err != nil {
		return nil, err
	}

	enabledSet := make(map[string]struct{}, len(enabled))
	for _, name := range enabled {
		enabledSet[name] = struct{}{}
	}

	out := make([]dto.PlaygroundSpeechModel, 0)
	for _, meta := range catalog {
		if _, ok := enabledSet[meta.ModelName]; !ok {
			continue
		}
		if !ModelTagsContain(meta.Tags, constant.ModelTagT2A) {
			continue
		}
		profile := SpeechRequestProfile(meta.ModelName)
		out = append(out, dto.PlaygroundSpeechModel{
			Model:        meta.ModelName,
			Tags:         ParseModelTags(meta.Tags),
			Groups:       modelGroups[meta.ModelName],
			Profile:      profile,
			Label:        meta.ModelName,
			Capabilities: speechCapabilitiesForModel(meta.ModelName, profile),
		})
	}
	return out, nil
}
