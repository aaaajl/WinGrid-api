package bailianaudio

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// dashScopeTTSPath is the DashScope non-realtime speech synthesis endpoint.
// The Qwen-Audio-TTS family (qwen-audio-3.0-tts-plus/flash) and CosyVoice are
// served here; the Qwen-TTS family (qwen3-tts-flash, qwen-tts) uses the
// multimodal-generation endpoint instead. Mixing them yields the upstream
// "url error, please check url！" (error-url) rejection.
const dashScopeTTSPath = "/api/v1/services/audio/tts/SpeechSynthesizer"

// defaultTTSVoice is the DashScope system voice used when the client omits one.
// The SpeechSynthesizer endpoint requires voice, and Qwen-Audio-TTS does not
// share OpenAI's voice names.
const defaultTTSVoice = "longanhuan_v3.6"

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeAudioSpeech {
		return "", fmt.Errorf("unsupported relay mode for bailian audio: %d", info.RelayMode)
	}
	return strings.TrimSuffix(info.ChannelBaseUrl, "/") + dashScopeTTSPath, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	req.Set("Content-Type", "application/json")
	if info.IsStream {
		req.Set("X-DashScope-SSE", "enable")
	}
	return nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if info.RelayMode != relayconstant.RelayModeAudioSpeech {
		return nil, fmt.Errorf("unsupported relay mode for bailian audio: %d", info.RelayMode)
	}
	text := strings.TrimSpace(request.Input)
	if text == "" {
		return nil, errors.New("input is required")
	}

	input := QwenTTSInput{
		Text:          text,
		Voice:         strings.TrimSpace(request.Voice),
		LanguageHints: parseLanguageHints(request.Language),
		Instruction:   strings.TrimSpace(request.Instructions),
	}
	if len(request.Metadata) > 0 {
		var meta qwenTTSMetadata
		if err := common.Unmarshal(request.Metadata, &meta); err == nil {
			if input.Voice == "" {
				input.Voice = strings.TrimSpace(meta.Voice)
			}
			if len(input.LanguageHints) == 0 {
				input.LanguageHints = parseLanguageHints(meta.LanguageHints)
			}
			if input.Instruction == "" {
				input.Instruction = strings.TrimSpace(meta.Instruction)
			}
		}
	}
	if input.Voice == "" {
		input.Voice = defaultTTSVoice
	}

	payload, err := common.Marshal(QwenTTSRequest{Model: request.Model, Input: input})
	if err != nil {
		return nil, fmt.Errorf("marshal bailian tts request failed: %w", err)
	}
	return bytes.NewReader(payload), nil
}

// parseLanguageHints accepts a raw JSON value holding either a single language
// code or an array of them, returning the trimmed, non-empty entries.
// AudioRequest carries vendor-specific fields as json.RawMessage to stay
// provider-agnostic.
func parseLanguageHints(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var single string
	if err := common.Unmarshal(raw, &single); err == nil {
		if value := strings.TrimSpace(single); value != "" {
			return []string{value}
		}
		return nil
	}
	var list []string
	if err := common.Unmarshal(raw, &list); err != nil {
		return nil
	}
	hints := make([]string, 0, len(list))
	for _, value := range list {
		if value = strings.TrimSpace(value); value != "" {
			hints = append(hints, value)
		}
	}
	if len(hints) == 0 {
		return nil
	}
	return hints
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeAudioSpeech {
		return nil, types.NewError(
			fmt.Errorf("unsupported relay mode for bailian audio: %d", info.RelayMode),
			types.ErrorCodeInvalidRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if info.IsStream {
		return handleQwenTTSStreamResponse(c, resp, info)
	}
	return handleQwenTTSResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
