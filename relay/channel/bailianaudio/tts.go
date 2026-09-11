package bailianaudio

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func qwenTTSError(ttsResp *QwenTTSResponse) *types.NewAPIError {
	if ttsResp.Code == "" && ttsResp.StatusCode < http.StatusBadRequest {
		return nil
	}
	message := ttsResp.Message
	if message == "" {
		message = "unknown error"
	}
	return types.NewErrorWithStatusCode(
		fmt.Errorf("bailian tts error: %s - %s", ttsResp.Code, message),
		types.ErrorCodeBadResponse,
		http.StatusBadRequest,
	)
}

func qwenTTSUsage(ttsResp *QwenTTSResponse, usage *dto.Usage) {
	usage.PromptTokens = ttsResp.Usage.InputTokens
	usage.CompletionTokens = ttsResp.Usage.OutputTokens
	usage.InputTokens = ttsResp.Usage.InputTokens
	usage.OutputTokens = ttsResp.Usage.OutputTokens
	usage.Characters = ttsResp.Usage.Characters
	usage.TotalTokens = ttsResp.Usage.TotalTokens
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
}

// handleQwenTTSResponse returns the synthesized audio for a non-streaming
// request, downloading the temporary output URL DashScope provides.
func handleQwenTTSResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("read bailian tts response failed: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	var ttsResp QwenTTSResponse
	if err := common.Unmarshal(body, &ttsResp); err != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("unmarshal bailian tts response failed: %w", err),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}
	if apiErr := qwenTTSError(&ttsResp); apiErr != nil {
		return nil, apiErr
	}

	audioBytes, contentType, apiErr := resolveQwenTTSAudio(&ttsResp)
	if apiErr != nil {
		return nil, apiErr
	}

	usage := &dto.Usage{}
	qwenTTSUsage(&ttsResp, usage)
	c.Data(http.StatusOK, contentType, audioBytes)
	return usage, nil
}

// resolveQwenTTSAudio returns the audio bytes either from the inline base64
// payload or by downloading the temporary URL.
func resolveQwenTTSAudio(ttsResp *QwenTTSResponse) ([]byte, string, *types.NewAPIError) {
	if data := strings.TrimSpace(ttsResp.Output.Audio.Data); data != "" {
		decoded, err := base64.StdEncoding.DecodeString(data)
		if err != nil {
			return nil, "", types.NewErrorWithStatusCode(
				fmt.Errorf("decode bailian tts audio failed: %w", err),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			)
		}
		return decoded, "audio/pcm", nil
	}

	url := strings.TrimSpace(ttsResp.Output.Audio.URL)
	if url == "" {
		return nil, "", types.NewErrorWithStatusCode(
			errors.New("bailian tts response contains no audio"),
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}

	downloadResp, err := service.DoDownloadRequest(url, "bailian tts audio")
	if err != nil {
		return nil, "", types.NewErrorWithStatusCode(
			fmt.Errorf("download bailian tts audio failed: %w", err),
			types.ErrorCodeDoRequestFailed,
			http.StatusBadGateway,
		)
	}
	defer service.CloseResponseBodyGracefully(downloadResp)

	if downloadResp.StatusCode != http.StatusOK {
		return nil, "", types.NewErrorWithStatusCode(
			fmt.Errorf("download bailian tts audio failed with status %d", downloadResp.StatusCode),
			types.ErrorCodeDoRequestFailed,
			http.StatusBadGateway,
		)
	}
	audioBytes, err := io.ReadAll(downloadResp.Body)
	if err != nil {
		return nil, "", types.NewErrorWithStatusCode(
			fmt.Errorf("read bailian tts audio failed: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusBadGateway,
		)
	}
	return audioBytes, contentTypeForAudioURL(url), nil
}

func contentTypeForAudioURL(rawURL string) string {
	trimmed := rawURL
	if idx := strings.IndexAny(trimmed, "?#"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	switch strings.ToLower(path.Ext(trimmed)) {
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".flac":
		return "audio/flac"
	case ".aac":
		return "audio/aac"
	case ".opus":
		return "audio/opus"
	case ".pcm":
		return "audio/pcm"
	default:
		return "audio/wav"
	}
}

// handleQwenTTSStreamResponse translates DashScope's SSE chunks into
// OpenAI-compatible speech.audio.delta / speech.audio.done events.
func handleQwenTTSStreamResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	usage := &dto.Usage{}
	var streamErr error

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var chunk QwenTTSResponse
		if err := common.Unmarshal([]byte(data), &chunk); err != nil {
			// Ignore non-JSON keepalive / comment frames.
			return
		}
		if apiErr := qwenTTSError(&chunk); apiErr != nil {
			streamErr = apiErr
			sr.Stop(apiErr)
			return
		}
		if chunk.Usage.Characters > 0 || chunk.Usage.TotalTokens > 0 ||
			chunk.Usage.InputTokens > 0 || chunk.Usage.OutputTokens > 0 {
			qwenTTSUsage(&chunk, usage)
		}

		audio := strings.TrimSpace(chunk.Output.Audio.Data)
		if audio == "" {
			return
		}
		if err := writeSSEEvent(c, "speech.audio.delta", speechAudioDeltaEvent{
			Type:  "speech.audio.delta",
			Audio: audio,
		}); err != nil {
			streamErr = err
			sr.Stop(err)
		}
	})

	if streamErr != nil {
		return nil, types.NewError(streamErr, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	done := speechAudioDoneEvent{
		Type: "speech.audio.done",
		Usage: speechAudioUsage{
			InputTokens:  usage.InputTokens,
			OutputTokens: usage.OutputTokens,
			TotalTokens:  usage.TotalTokens,
			Characters:   usage.Characters,
		},
	}
	if err := writeSSEEvent(c, "speech.audio.done", done); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}
	return usage, nil
}

func writeSSEEvent(c *gin.Context, event string, payload any) error {
	data, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	helper.ExtendWriteDeadline(c)
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\ndata: %s\n\n", event, data)})
	return helper.FlushWriter(c)
}
