package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImageRequestProfile(t *testing.T) {
	assert.Equal(t, ImageProfileDalle2, ImageRequestProfile("dall-e-2"))
	assert.Equal(t, ImageProfileDalle2, ImageRequestProfile("dall-e"))
	assert.Equal(t, ImageProfileDalle3, ImageRequestProfile("dall-e-3"))
	assert.Equal(t, ImageProfileGptImage, ImageRequestProfile("gpt-image-1"))
	assert.Equal(t, ImageProfileGptImage, ImageRequestProfile("gpt-image-1-mini"))
	assert.Equal(t, ImageProfileAgnesImage, ImageRequestProfile("agnes-image-2.0-flash"))
	assert.Equal(t, ImageProfileAgnesImage, ImageRequestProfile("agnes-image-2.1-flash"))
	assert.Equal(t, ImageProfileGeneric, ImageRequestProfile("flux-schnell"))
}

func TestAgnesImageCapabilities(t *testing.T) {
	v20 := agnesImageCapabilities("agnes-image-2.0-flash")
	assert.Equal(t, []string{"1024x1024", "1024x768", "768x1024"}, v20.SupportedSizes)
	assert.Equal(t, [2]int{1, 1}, v20.NRange)
	assert.Equal(t, []string{"prompt", "size"}, v20.Fields)

	v21 := agnesImageCapabilities("agnes-image-2.1-flash")
	assert.Equal(t, []string{"1K", "2K", "3K", "4K"}, v21.SupportedSizes)
	assert.Equal(t, []string{"prompt", "size"}, v21.Fields)
}

func TestListPlaygroundImageModels(t *testing.T) {
	db := setupPlaygroundVideoTestDB(t)

	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "dall-e-3", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "gpt-image-1", ChannelId: 2, Enabled: true},
		{Group: "default", Model: "flux-schnell", ChannelId: 3, Enabled: true},
		{Group: "default", Model: "agnes-image-2.0-flash", ChannelId: 4, Enabled: true},
		{Group: "default", Model: "dall-e-no-catalog", ChannelId: 5, Enabled: true},
		{Group: "default", Model: "dall-e-disabled", ChannelId: 6, Enabled: true},
		{Group: "default", Model: "chat-only", ChannelId: 7, Enabled: true},
	}).Error)

	now := common.GetTimestamp()
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "dall-e-3", Tags: "t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "gpt-image-1", Tags: "image,t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "flux-schnell", Tags: "t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "agnes-image-2.0-flash", Tags: "t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "dall-e-disabled", Tags: "t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "chat-only", Tags: "t2t", Status: 1, CreatedTime: now, UpdatedTime: now},
	}).Error)
	require.NoError(t, db.Model(&model.Model{}).
		Where("model_name = ?", "dall-e-disabled").
		Update("status", 0).Error)

	models, err := ListPlaygroundImageModels("default")
	require.NoError(t, err)
	require.Len(t, models, 4)

	names := make([]string, 0, len(models))
	for _, item := range models {
		names = append(names, item.Model)
	}
	assert.ElementsMatch(t, []string{
		"dall-e-3",
		"gpt-image-1",
		"flux-schnell",
		"agnes-image-2.0-flash",
	}, names)

	for _, item := range models {
		switch item.Model {
		case "dall-e-3":
			assert.Equal(t, ImageProfileDalle3, item.Profile)
			assert.Equal(t, [2]int{1, 1}, item.Capabilities.NRange)
			assert.Equal(t, []string{"prompt", "size", "n"}, item.Capabilities.Fields)
		case "gpt-image-1":
			assert.Equal(t, ImageProfileGptImage, item.Profile)
			assert.Equal(t, []string{"prompt", "size", "n"}, item.Capabilities.Fields)
		case "flux-schnell":
			assert.Equal(t, ImageProfileGeneric, item.Profile)
			assert.Equal(t, []string{"prompt", "size", "n"}, item.Capabilities.Fields)
		case "agnes-image-2.0-flash":
			assert.Equal(t, ImageProfileAgnesImage, item.Profile)
			assert.Equal(t, []string{"1024x1024", "1024x768", "768x1024"}, item.Capabilities.SupportedSizes)
			assert.Equal(t, []string{"prompt", "size"}, item.Capabilities.Fields)
		default:
			t.Fatalf("unexpected model %s", item.Model)
		}
		assert.NotEmpty(t, item.Capabilities.SupportedSizes)
	}
}
