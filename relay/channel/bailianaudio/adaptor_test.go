package bailianaudio

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTTSContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
	return ctx
}

func TestGetRequestURL(t *testing.T) {
	adaptor := &Adaptor{}

	url, err := adaptor.GetRequestURL(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioSpeech,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://dashscope.aliyuncs.com/",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer", url)

	_, err = adaptor.GetRequestURL(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://dashscope.aliyuncs.com",
		},
	})
	require.Error(t, err)
}

func TestSetupRequestHeader(t *testing.T) {
	adaptor := &Adaptor{}
	ctx := newTTSContext()

	header := http.Header{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "sk-test"},
	}
	require.NoError(t, adaptor.SetupRequestHeader(ctx, &header, info))
	assert.Equal(t, "Bearer sk-test", header.Get("Authorization"))
	assert.Equal(t, "application/json", header.Get("Content-Type"))
	assert.Empty(t, header.Get("X-DashScope-SSE"))

	info.IsStream = true
	streamHeader := http.Header{}
	require.NoError(t, adaptor.SetupRequestHeader(ctx, &streamHeader, info))
	assert.Equal(t, "enable", streamHeader.Get("X-DashScope-SSE"))
}

func TestConvertAudioRequest(t *testing.T) {
	adaptor := &Adaptor{}
	ctx := newTTSContext()
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}

	cases := []struct {
		name          string
		raw           string
		wantText      string
		wantVoice     string
		wantLanguages []string
	}{
		{
			name:          "top level voice and language",
			raw:           `{"model":"qwen-audio-3.0-tts-flash","input":"  你好世界  ","voice":"longanhuan_v3.6","language":"zh","instructions":"用温柔的语气"}`,
			wantText:      "你好世界",
			wantVoice:     "longanhuan_v3.6",
			wantLanguages: []string{"zh"},
		},
		{
			name:          "metadata supplies voice and language",
			raw:           `{"model":"qwen-audio-3.0-tts-plus","input":"hello","metadata":{"voice":"longanxiaoxin","language_hints":["en"]}}`,
			wantText:      "hello",
			wantVoice:     "longanxiaoxin",
			wantLanguages: []string{"en"},
		},
		{
			name:          "language array is preserved",
			raw:           `{"model":"qwen-audio-3.0-tts-flash","input":"hi","voice":"longanhuan_v3.6","language":["zh","en"]}`,
			wantText:      "hi",
			wantVoice:     "longanhuan_v3.6",
			wantLanguages: []string{"zh", "en"},
		},
		{
			name:          "missing voice falls back to system default",
			raw:           `{"model":"qwen-audio-3.0-tts-flash","input":"hi"}`,
			wantText:      "hi",
			wantVoice:     defaultTTSVoice,
			wantLanguages: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req dto.AudioRequest
			require.NoError(t, common.Unmarshal([]byte(tc.raw), &req))

			reader, err := adaptor.ConvertAudioRequest(ctx, info, req)
			require.NoError(t, err)
			body, err := io.ReadAll(reader)
			require.NoError(t, err)

			var got QwenTTSRequest
			require.NoError(t, common.Unmarshal(body, &got))
			assert.Equal(t, req.Model, got.Model)
			assert.Equal(t, tc.wantText, got.Input.Text)
			assert.Equal(t, tc.wantVoice, got.Input.Voice)
			assert.Equal(t, tc.wantLanguages, got.Input.LanguageHints)
		})
	}
}

func TestConvertAudioRequestCarriesInstruction(t *testing.T) {
	adaptor := &Adaptor{}
	ctx := newTTSContext()
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}

	var req dto.AudioRequest
	require.NoError(t, common.Unmarshal([]byte(`{"model":"qwen-audio-3.0-tts-flash","input":"hi","instructions":"用四川话"}`), &req))

	reader, err := adaptor.ConvertAudioRequest(ctx, info, req)
	require.NoError(t, err)
	body, err := io.ReadAll(reader)
	require.NoError(t, err)

	var got QwenTTSRequest
	require.NoError(t, common.Unmarshal(body, &got))
	assert.Equal(t, "用四川话", got.Input.Instruction)
}

func TestConvertAudioRequestRejectsInvalidInput(t *testing.T) {
	adaptor := &Adaptor{}
	ctx := newTTSContext()

	_, err := adaptor.ConvertAudioRequest(ctx, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}, dto.AudioRequest{Model: "m", Input: "   "})
	require.Error(t, err)

	_, err = adaptor.ConvertAudioRequest(ctx, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions}, dto.AudioRequest{Model: "m", Input: "hi"})
	require.Error(t, err)
}

func TestParseLanguageHints(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want []string
	}{
		{name: "single string", raw: `"zh"`, want: []string{"zh"}},
		{name: "trims string", raw: `  " zh "  `, want: []string{"zh"}},
		{name: "array", raw: `["zh","en"]`, want: []string{"zh", "en"}},
		{name: "drops blank entries", raw: `["zh",""," en "]`, want: []string{"zh", "en"}},
		{name: "empty array", raw: `[]`, want: nil},
		{name: "blank string", raw: `"   "`, want: nil},
		{name: "non string", raw: `123`, want: nil},
		{name: "absent", raw: ``, want: nil},
		{name: "malformed", raw: `"`, want: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, parseLanguageHints([]byte(tc.raw)))
		})
	}
}

func TestContentTypeForAudioURL(t *testing.T) {
	cases := map[string]string{
		"https://example.com/a.mp3":           "audio/mpeg",
		"https://example.com/a.wav?token=abc": "audio/wav",
		"https://example.com/a.flac":          "audio/flac",
		"https://example.com/a.aac":           "audio/aac",
		"https://example.com/a.opus":          "audio/opus",
		"https://example.com/a.pcm":           "audio/pcm",
		"https://example.com/a.unknown":       "audio/wav",
	}

	for url, want := range cases {
		t.Run(url, func(t *testing.T) {
			assert.Equal(t, want, contentTypeForAudioURL(url))
		})
	}
}

func TestHandleQwenTTSResponseReturnsAudioAndCharacters(t *testing.T) {
	encoded := base64.StdEncoding.EncodeToString([]byte("pcm-bytes"))
	body := `{"status_code":200,"output":{"audio":{"data":"` + encoded + `"}},"usage":{"characters":7,"input_tokens":2,"output_tokens":3,"total_tokens":5}}`

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usageAny, apiErr := handleQwenTTSResponse(c, resp, &relaycommon.RelayInfo{})
	require.Nil(t, apiErr)
	require.NotNil(t, usageAny)

	usage := usageAny.(*dto.Usage)
	assert.Equal(t, 7, usage.Characters)
	assert.Equal(t, 5, usage.TotalTokens)
	assert.Equal(t, []byte("pcm-bytes"), recorder.Body.Bytes())
	assert.Contains(t, recorder.Header().Get("Content-Type"), "audio/pcm")
}

func TestHandleQwenTTSResponseSurfacesUpstreamError(t *testing.T) {
	body := `{"status_code":400,"code":"InvalidParameter","message":"bad voice"}`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	_, apiErr := handleQwenTTSResponse(c, resp, &relaycommon.RelayInfo{})
	require.NotNil(t, apiErr)
}

func TestResolveQwenTTSAudioRejectsEmptyAudio(t *testing.T) {
	_, _, apiErr := resolveQwenTTSAudio(&QwenTTSResponse{})
	require.NotNil(t, apiErr)
}

func TestHandleQwenTTSStreamResponseEmitsOpenAIEvents(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	streamBody := strings.Join([]string{
		`data: {"output":{"audio":{"data":"AAE="}},"usage":{"characters":3}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(streamBody)),
	}

	usageAny, apiErr := handleQwenTTSStreamResponse(c, resp, &relaycommon.RelayInfo{IsStream: true})
	require.Nil(t, apiErr)

	usage := usageAny.(*dto.Usage)
	assert.Equal(t, 3, usage.Characters)

	written := recorder.Body.String()
	assert.Contains(t, written, "event: speech.audio.delta")
	assert.Contains(t, written, `"audio":"AAE="`)
	assert.Contains(t, written, "event: speech.audio.done")
	assert.Contains(t, written, `"characters":3`)
}
