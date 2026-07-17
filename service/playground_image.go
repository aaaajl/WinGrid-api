package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	ImageProfileDalle2     = "dalle2"
	ImageProfileDalle3     = "dalle3"
	ImageProfileGptImage   = "gpt_image"
	ImageProfileAgnesImage = "agnes_image"
	ImageProfileGeneric    = "generic"
)

// ImageRequestProfile maps a model name to its playground image request profile.
func ImageRequestProfile(modelName string) string {
	lower := strings.ToLower(modelName)
	switch {
	case lower == "dall-e-2" || lower == "dall-e":
		return ImageProfileDalle2
	case lower == "dall-e-3" || strings.HasPrefix(lower, "dall-e-3"):
		return ImageProfileDalle3
	case strings.HasPrefix(lower, "gpt-image"):
		return ImageProfileGptImage
	case strings.HasPrefix(lower, "agnes-image-"):
		return ImageProfileAgnesImage
	default:
		return ImageProfileGeneric
	}
}

func dalle2Capabilities() dto.ImageCapabilities {
	return dto.ImageCapabilities{
		SupportedSizes: []string{"256x256", "512x512", "1024x1024"},
		NRange:         [2]int{1, 10},
		Fields:         []string{"prompt", "size", "n"},
	}
}

func dalle3Capabilities() dto.ImageCapabilities {
	return dto.ImageCapabilities{
		SupportedSizes: []string{"1024x1024", "1024x1792", "1792x1024"},
		NRange:         [2]int{1, 1},
		Fields:         []string{"prompt", "size", "n"},
	}
}

func gptImageCapabilities() dto.ImageCapabilities {
	return dto.ImageCapabilities{
		SupportedSizes: []string{"1024x1024", "1536x1024", "1024x1536", "auto"},
		NRange:         [2]int{1, 10},
		Fields:         []string{"prompt", "size", "n"},
	}
}

func genericImageCapabilities() dto.ImageCapabilities {
	return dto.ImageCapabilities{
		SupportedSizes: []string{"1024x1024", "512x512", "256x256"},
		NRange:         [2]int{1, 10},
		Fields:         []string{"prompt", "size", "n"},
	}
}

// agnesImageCapabilities returns Agnes-documented sizes. 2.0 uses pixel
// presets; 2.1 uses quality tiers (1K–4K). Agnes does not accept OpenAI n.
func agnesImageCapabilities(modelName string) dto.ImageCapabilities {
	lower := strings.ToLower(modelName)
	sizes := []string{"1024x1024", "1024x768", "768x1024"}
	if strings.Contains(lower, "agnes-image-2.1") || strings.Contains(lower, "agnes-image-2-1") {
		sizes = []string{"1K", "2K", "3K", "4K"}
	}
	return dto.ImageCapabilities{
		SupportedSizes: sizes,
		NRange:         [2]int{1, 1},
		Fields:         []string{"prompt", "size"},
	}
}

func imageCapabilitiesForProfile(profile, modelName string) dto.ImageCapabilities {
	switch profile {
	case ImageProfileDalle2:
		return dalle2Capabilities()
	case ImageProfileDalle3:
		return dalle3Capabilities()
	case ImageProfileGptImage:
		return gptImageCapabilities()
	case ImageProfileAgnesImage:
		return agnesImageCapabilities(modelName)
	default:
		return genericImageCapabilities()
	}
}

// ListPlaygroundImageModels returns catalog-backed t2i models available to the user group.
func ListPlaygroundImageModels(group string) ([]dto.PlaygroundImageModel, error) {
	enabled := model.GetGroupEnabledModels(group)
	if len(enabled) == 0 {
		return []dto.PlaygroundImageModel{}, nil
	}

	catalog, err := model.GetEnabledCatalogModelsByNames(enabled)
	if err != nil {
		return nil, err
	}

	enabledSet := make(map[string]struct{}, len(enabled))
	for _, name := range enabled {
		enabledSet[name] = struct{}{}
	}

	out := make([]dto.PlaygroundImageModel, 0)
	for _, meta := range catalog {
		if _, ok := enabledSet[meta.ModelName]; !ok {
			continue
		}
		if !ModelTagsContain(meta.Tags, constant.ModelTagT2I) {
			continue
		}
		profile := ImageRequestProfile(meta.ModelName)
		out = append(out, dto.PlaygroundImageModel{
			Model:        meta.ModelName,
			Tags:         ParseModelTags(meta.Tags),
			Profile:      profile,
			Label:        meta.ModelName,
			Capabilities: imageCapabilitiesForProfile(profile, meta.ModelName),
		})
	}
	return out, nil
}
