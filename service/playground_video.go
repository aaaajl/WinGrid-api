package service

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	VideoProfileHappyHorse = "happyhorse"
	VideoProfileSeedance   = "seedance"
	VideoProfileGeneric    = "generic"
)

// VideoRequestProfile maps a model name to its playground video request profile.
func VideoRequestProfile(modelName string) string {
	switch {
	case strings.HasPrefix(modelName, "happyhorse-"):
		return VideoProfileHappyHorse
	case strings.HasPrefix(modelName, "doubao-seedance-"):
		return VideoProfileSeedance
	default:
		// Catalog models tagged t2v without a known vendor prefix use the
		// generic TaskSubmitReq shape (prompt/size/duration).
		return VideoProfileGeneric
	}
}

// ParseModelTags splits comma-separated catalog tags (case-insensitive trim).
func ParseModelTags(tags string) []string {
	if strings.TrimSpace(tags) == "" {
		return nil
	}
	parts := strings.Split(tags, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		tag := strings.ToLower(strings.TrimSpace(part))
		if tag != "" {
			out = append(out, tag)
		}
	}
	return out
}

// ModelTagsContain reports whether tags contain the given tag (case-insensitive).
func ModelTagsContain(tags string, want string) bool {
	want = strings.ToLower(strings.TrimSpace(want))
	for _, tag := range ParseModelTags(tags) {
		if tag == want {
			return true
		}
	}
	return false
}

func happyHorseCapabilities(_ string) dto.HappyHorseVideoCapabilities {
	return dto.HappyHorseVideoCapabilities{
		SupportedSizes: []string{"720P", "1080P"},
		DurationRange:  [2]int{2, 15},
		Fields:         []string{"prompt_extend", "watermark", "seed"},
	}
}

func seedanceCapabilities(modelName string) dto.SeedanceVideoCapabilities {
	resolutions := []string{"480p", "720p", "1080p"}
	if strings.Contains(modelName, "seedance-2-0") {
		resolutions = append(resolutions, "4k")
	}
	return dto.SeedanceVideoCapabilities{
		SupportedResolutions: resolutions,
		SupportedRatios:      []string{"16:9", "9:16", "1:1"},
		DurationRange:        [2]int{2, 12},
		Fields:               []string{"watermark", "seed", "camera_fixed", "generate_audio"},
	}
}

func genericCapabilities(_ string) dto.GenericVideoCapabilities {
	return dto.GenericVideoCapabilities{
		SupportedSizes: []string{"720P", "1080P"},
		DurationRange:  [2]int{2, 15},
		Fields:         []string{"size", "duration"},
		Form:           "generic",
	}
}

func playgroundVideoLabel(_profile, modelName string) string {
	return modelName
}

// ListPlaygroundVideoModels returns catalog-backed t2v models available to the user group.
func ListPlaygroundVideoModels(group string) ([]dto.PlaygroundVideoModel, error) {
	enabled := model.GetGroupEnabledModels(group)
	if len(enabled) == 0 {
		return []dto.PlaygroundVideoModel{}, nil
	}

	catalog, err := model.GetEnabledCatalogModelsByNames(enabled)
	if err != nil {
		return nil, err
	}

	enabledSet := make(map[string]struct{}, len(enabled))
	for _, name := range enabled {
		enabledSet[name] = struct{}{}
	}

	out := make([]dto.PlaygroundVideoModel, 0)
	for _, meta := range catalog {
		if _, ok := enabledSet[meta.ModelName]; !ok {
			continue
		}
		if !ModelTagsContain(meta.Tags, constant.ModelTagT2V) {
			continue
		}
		profile := VideoRequestProfile(meta.ModelName)

		item := dto.PlaygroundVideoModel{
			Model:   meta.ModelName,
			Tags:    ParseModelTags(meta.Tags),
			Profile: profile,
			Label:   playgroundVideoLabel(profile, meta.ModelName),
		}
		switch profile {
		case VideoProfileHappyHorse:
			item.Capabilities = happyHorseCapabilities(meta.ModelName)
		case VideoProfileSeedance:
			item.Capabilities = seedanceCapabilities(meta.ModelName)
		default:
			item.Capabilities = genericCapabilities(meta.ModelName)
		}
		out = append(out, item)
	}
	return out, nil
}
