package bailianaudio

import "encoding/json"

// QwenTTSRequest is the DashScope non-realtime speech synthesis request body.
type QwenTTSRequest struct {
	Model string       `json:"model"`
	Input QwenTTSInput `json:"input"`
}

type QwenTTSInput struct {
	Text          string   `json:"text"`
	Voice         string   `json:"voice"`
	LanguageHints []string `json:"language_hints,omitempty"`
	Instruction   string   `json:"instruction,omitempty"`
}

// QwenTTSResponse covers both the non-streaming body and each SSE data chunk.
type QwenTTSResponse struct {
	StatusCode int           `json:"status_code"`
	RequestID  string        `json:"request_id"`
	Code       string        `json:"code"`
	Message    string        `json:"message"`
	Output     QwenTTSOutput `json:"output"`
	Usage      QwenTTSUsage  `json:"usage"`
}

type QwenTTSOutput struct {
	FinishReason string       `json:"finish_reason"`
	Audio        QwenTTSAudio `json:"audio"`
}

type QwenTTSAudio struct {
	Data      string `json:"data"`
	URL       string `json:"url"`
	ID        string `json:"id"`
	ExpiresAt int64  `json:"expires_at"`
}

type QwenTTSUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
	Characters   int `json:"characters"`
}

// qwenTTSMetadata is the vendor-specific escape hatch accepted on the OpenAI
// audio request's metadata field.
type qwenTTSMetadata struct {
	Voice         string          `json:"voice"`
	LanguageHints json.RawMessage `json:"language_hints"`
	Instruction   string          `json:"instruction"`
}

// speechAudioDeltaEvent is the OpenAI-compatible SSE audio chunk event.
type speechAudioDeltaEvent struct {
	Type  string `json:"type"`
	Audio string `json:"audio"`
}

type speechAudioUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
	Characters   int `json:"characters,omitempty"`
}

// speechAudioDoneEvent is the OpenAI-compatible SSE terminal event.
type speechAudioDoneEvent struct {
	Type  string           `json:"type"`
	Usage speechAudioUsage `json:"usage"`
}
