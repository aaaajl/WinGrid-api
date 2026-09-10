package wan30video

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func wan30RelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func TestConvertToWan30RequestPreservesExplicitFalseAndDefaults(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model:  "wan3.0-video",
		Prompt: "a cat running on a roof",
		Size:   "480p",
		Metadata: map[string]any{
			"audio":         false,
			"prompt_extend": false,
			"watermark":     false,
		},
	}

	converted, normalized, err := convertToWan30Request(wan30RelayInfo(), req)

	require.NoError(t, err)
	require.NoError(t, validateWan30Request(converted))
	assert.Equal(t, "480P", converted.Parameters.Resolution)
	assert.Equal(t, defaultDuration, converted.Parameters.Duration)
	assert.Equal(t, defaultRatio, converted.Parameters.Ratio)
	require.NotNil(t, converted.Parameters.Audio)
	require.NotNil(t, converted.Parameters.PromptExtend)
	require.NotNil(t, converted.Parameters.Watermark)
	assert.False(t, *converted.Parameters.Audio)
	assert.False(t, *converted.Parameters.PromptExtend)
	assert.False(t, *converted.Parameters.Watermark)
	assert.Equal(t, "480P", normalized.Size)
	assert.Equal(t, defaultDuration, normalized.Duration)

	body, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.Contains(t, string(body), `"audio":false`)
	assert.Contains(t, string(body), `"prompt_extend":false`)
	assert.Contains(t, string(body), `"watermark":false`)
}

func TestConvertToWan30RequestUsesMappedModelAndMedia(t *testing.T) {
	info := wan30RelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "wan3.0-video-prime"
	req := relaycommon.TaskSubmitReq{
		Model:  "public-video-model",
		Prompt: "move from the first frame to the last",
		Metadata: map[string]any{
			"media": []any{
				map[string]any{"type": "first_frame", "url": "https://example.com/first.png"},
				map[string]any{"type": "last_frame", "url": "https://example.com/last.png"},
			},
		},
	}

	converted, _, err := convertToWan30Request(info, req)

	require.NoError(t, err)
	require.NoError(t, validateWan30Request(converted))
	assert.Equal(t, "wan3.0-video-prime", converted.Model)
	assert.Equal(t, []Wan30Media{
		{Type: "first_frame", URL: "https://example.com/first.png"},
		{Type: "last_frame", URL: "https://example.com/last.png"},
	}, converted.Input.Media)
}

func TestConvertToWan30RequestAcceptsNestedMediaAlias(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		Model: "wan3.0-video",
		Metadata: map[string]any{
			"input": map[string]any{
				"media": []any{
					map[string]any{"type": "file", "url": "https://example.com/deck.pptx"},
				},
			},
		},
	}

	converted, _, err := convertToWan30Request(wan30RelayInfo(), req)

	require.NoError(t, err)
	require.NoError(t, validateWan30Request(converted))
	assert.Equal(t, []Wan30Media{{Type: "file", URL: "https://example.com/deck.pptx"}}, converted.Input.Media)
}

func TestValidateRequestAcceptsMediaWithoutPromptAndStoresBillingDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(`{
		"model":"wan3.0-video",
		"metadata":{"media":[{"type":"file","url":"https://example.com/brief.pdf"}]}
	}`))
	context.Request.Header.Set("Content-Type", "application/json")
	info := wan30RelayInfo()

	taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(context, info)

	require.Nil(t, taskErr)
	stored, err := relaycommon.GetTaskRequest(context)
	require.NoError(t, err)
	assert.Equal(t, defaultDuration, stored.Duration)
	assert.Equal(t, defaultResolution, stored.Size)
	assert.Equal(t, map[string]float64{"seconds": 5}, (&TaskAdaptor{}).EstimateBilling(context, info))
}

func TestValidateWan30RequestRejectsInvalidContracts(t *testing.T) {
	longPrompt := strings.Repeat("界", maxPromptRunes+1)
	tests := []struct {
		name    string
		request *Wan30Request
		want    string
	}{
		{
			name: "empty prompt and media",
			request: &Wan30Request{
				Model: "wan3.0-video", Parameters: validParameters(),
			},
			want: "prompt or media is required",
		},
		{
			name: "prompt too long",
			request: &Wan30Request{
				Model: "wan3.0-video", Input: Wan30Input{Prompt: longPrompt}, Parameters: validParameters(),
			},
			want: "20000",
		},
		{
			name: "frame and reference mixed",
			request: &Wan30Request{
				Model: "wan3.0-video", Parameters: validParameters(),
				Input: Wan30Input{Media: []Wan30Media{
					{Type: "first_frame", URL: "https://example.com/first.png"},
					{Type: "reference_image", URL: "https://example.com/ref.png"},
				}},
			},
			want: "cannot be combined",
		},
		{
			name: "last frame without first",
			request: &Wan30Request{
				Model: "wan3.0-video", Parameters: validParameters(),
				Input: Wan30Input{Media: []Wan30Media{
					{Type: "last_frame", URL: "https://example.com/last.png"},
				}},
			},
			want: "requires first_frame",
		},
		{
			name: "file and link mixed",
			request: &Wan30Request{
				Model: "wan3.0-video", Parameters: validParameters(),
				Input: Wan30Input{Media: []Wan30Media{
					{Type: "file", URL: "https://example.com/deck.pdf"},
					{Type: "link", URL: "https://example.com/article"},
				}},
			},
			want: "file and link",
		},
		{
			name: "smart duration disabled",
			request: &Wan30Request{
				Model: "wan3.0-video", Input: Wan30Input{Prompt: "test"},
				Parameters: func() Wan30Parameters {
					parameters := validParameters()
					parameters.Duration = -1
					return parameters
				}(),
			},
			want: "between 2 and 30",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateWan30Request(test.request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.want)
		})
	}
}

func validParameters() Wan30Parameters {
	audio := true
	promptExtend := true
	watermark := false
	return Wan30Parameters{
		Resolution:   "1080P",
		Ratio:        "adaptive",
		Duration:     5,
		Audio:        &audio,
		PromptExtend: &promptExtend,
		Watermark:    &watermark,
	}
}

func TestParseTaskResultMapsSuccessAndUnknown(t *testing.T) {
	adaptor := &TaskAdaptor{}

	success, err := adaptor.ParseTaskResult(nil, nil, []byte(`{
		"output":{"task_id":"upstream","task_status":"SUCCEEDED","video_url":"https://cdn.example.com/video.mp4"}
	}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusSuccess, success.Status)
	assert.Equal(t, "https://cdn.example.com/video.mp4", success.Url)

	unknown, err := adaptor.ParseTaskResult(nil, nil, []byte(`{
		"output":{"task_id":"expired","task_status":"UNKNOWN"}
	}`))
	require.NoError(t, err)
	assert.Equal(t, model.TaskStatusFailure, unknown.Status)
	assert.Contains(t, unknown.Reason, "expired")
}

func TestConvertToOpenAIVideoIncludesResultURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := &model.Task{
		TaskID: "task_public",
		Status: model.TaskStatusSuccess,
		Data: []byte(`{
			"output":{"task_id":"upstream","task_status":"SUCCEEDED","video_url":"https://cdn.example.com/video.mp4"}
		}`),
		Properties: model.Properties{OriginModelName: "wan3.0-video"},
	}

	body, err := adaptor.ConvertToOpenAIVideo(task)

	require.NoError(t, err)
	assert.Contains(t, string(body), `"id":"task_public"`)
	assert.Contains(t, string(body), `"url":"https://cdn.example.com/video.mp4"`)
	assert.Contains(t, string(body), `"status":"completed"`)
}
