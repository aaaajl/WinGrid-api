package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertToRequestPayload_UsesDuration(t *testing.T) {
	a := &TaskAdaptor{}
	body, err := a.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-1-5-pro-251215",
		Prompt:   "ocean waves",
		Duration: 5,
		Metadata: map[string]interface{}{
			"resolution":     "720p",
			"ratio":          "16:9",
			"watermark":      false,
			"camera_fixed":   false,
			"generate_audio": true,
		},
	})
	require.NoError(t, err)
	require.NotNil(t, body.Duration)
	assert.Equal(t, dto.IntValue(5), *body.Duration)
	assert.Equal(t, "720p", body.Resolution)
	assert.Equal(t, "16:9", body.Ratio)
	require.NotNil(t, body.GenerateAudio)
	assert.Equal(t, dto.BoolValue(true), *body.GenerateAudio)
	require.Len(t, body.Content, 1)
	assert.Equal(t, "text", body.Content[0].Type)
	assert.Equal(t, "ocean waves", body.Content[0].Text)
}

func TestConvertToRequestPayload_FallsBackToSeconds(t *testing.T) {
	a := &TaskAdaptor{}
	body, err := a.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:   "doubao-seedance-1-0-lite-t2v",
		Prompt:  "cat",
		Seconds: "8",
	})
	require.NoError(t, err)
	require.NotNil(t, body.Duration)
	assert.Equal(t, dto.IntValue(8), *body.Duration)
}

func TestConvertToRequestPayload_DurationOverridesSeconds(t *testing.T) {
	a := &TaskAdaptor{}
	body, err := a.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-1-5-pro-251215",
		Prompt:   "rain",
		Duration: 6,
		Seconds:  "12",
	})
	require.NoError(t, err)
	require.NotNil(t, body.Duration)
	assert.Equal(t, dto.IntValue(6), *body.Duration)
}
