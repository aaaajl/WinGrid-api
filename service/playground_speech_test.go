package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSpeechRequestProfile(t *testing.T) {
	assert.Equal(t, SpeechProfileOpenAI, SpeechRequestProfile("tts-1"))
	assert.Equal(t, SpeechProfileOpenAI, SpeechRequestProfile("gpt-4o-mini-tts"))
	assert.Equal(t, SpeechProfileQwen, SpeechRequestProfile("qwen-audio-3.0-tts-flash"))
	assert.Equal(t, SpeechProfileMiniMax, SpeechRequestProfile("MiniMax-Speech-02"))
	assert.Equal(t, SpeechProfileGeneric, SpeechRequestProfile("custom-speech"))
}

func TestSpeechCapabilitiesForModel(t *testing.T) {
	openai := speechCapabilitiesForModel("tts-1", SpeechProfileOpenAI)
	assert.Contains(t, openai.Voices, "alloy")
	assert.Contains(t, openai.ResponseFormats, "mp3")
	assert.Equal(t, [2]float64{0.25, 4}, openai.SpeedRange)
	assert.Contains(t, openai.Fields, "speed")
	assert.False(t, openai.AllowCustomVoice)

	generic := speechCapabilitiesForModel("custom-speech", SpeechProfileGeneric)
	assert.Contains(t, generic.Voices, "alloy")

	flash := speechCapabilitiesForModel("qwen-audio-3.0-tts-flash", SpeechProfileQwen)
	assert.Contains(t, flash.Voices, "longanhuan_v3.6")
	assert.Contains(t, flash.Voices, "loongjohn")
	// Qwen-Audio-TTS owns a model-scoped voice list plus cloned voices, so the
	// playground must offer a typed voice id and must not offer instructions:
	// DashScope's non-realtime endpoint rejects unsupported instruction params
	// and voices that belong to another model.
	assert.True(t, flash.AllowCustomVoice)
	assert.NotContains(t, flash.Fields, "instructions")
	assert.NotContains(t, flash.Fields, "response_format")

	plus := speechCapabilitiesForModel("qwen-audio-3.0-tts-plus", SpeechProfileQwen)
	assert.Contains(t, plus.Voices, "longanlufeng")
	// Voices are model-scoped: a flash-only voice must never be offered for plus.
	assert.NotContains(t, plus.Voices, "loongjohn")

	// The frontend indexes these arrays directly, so the JSON payload must
	// carry [] rather than null when a profile has no values for them.
	for _, tc := range []struct{ model, profile string }{
		{"tts-1", SpeechProfileOpenAI},
		{"qwen-audio-3.0-tts-flash", SpeechProfileQwen},
		{"qwen-audio-3.0-tts-plus", SpeechProfileQwen},
		{"qwen-unknown-tts", SpeechProfileQwen},
		{"MiniMax-Speech-02", SpeechProfileMiniMax},
		{"custom-speech", SpeechProfileGeneric},
	} {
		caps := speechCapabilitiesForModel(tc.model, tc.profile)
		assert.NotNil(t, caps.Voices, tc.model)
		assert.NotNil(t, caps.ResponseFormats, tc.model)
		assert.NotNil(t, caps.Fields, tc.model)
	}
}

func TestListPlaygroundSpeechModels(t *testing.T) {
	db := setupPlaygroundVideoTestDB(t)

	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "tts-1", ChannelId: 1, Enabled: true},
		{Group: "default", Model: "qwen-audio-3.0-tts-flash", ChannelId: 2, Enabled: true},
		{Group: "default", Model: "dall-e-3", ChannelId: 3, Enabled: true},
		{Group: "default", Model: "speech-untagged", ChannelId: 4, Enabled: true},
	}).Error)

	now := common.GetTimestamp()
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "tts-1", Tags: "t2a", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "qwen-audio-3.0-tts-flash", Tags: "audio,t2a", Status: 1, CreatedTime: now, UpdatedTime: now},
		{ModelName: "dall-e-3", Tags: "t2i", Status: 1, CreatedTime: now, UpdatedTime: now},
	}).Error)

	models, err := ListPlaygroundSpeechModels("default")
	require.NoError(t, err)
	require.Len(t, models, 2)

	byName := make(map[string]string, len(models))
	for _, item := range models {
		byName[item.Model] = item.Profile
		assert.Equal(t, []string{"default"}, item.Groups)
	}
	assert.Equal(t, SpeechProfileOpenAI, byName["tts-1"])
	assert.Equal(t, SpeechProfileQwen, byName["qwen-audio-3.0-tts-flash"])
}
