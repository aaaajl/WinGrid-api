package agensvideo

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

type createRequest struct {
	Model              string         `json:"model"`
	Prompt             string         `json:"prompt"`
	Image              string         `json:"image,omitempty"`
	Mode               string         `json:"mode,omitempty"`
	Height             *int           `json:"height,omitempty"`
	Width              *int           `json:"width,omitempty"`
	NumFrames          *int           `json:"num_frames,omitempty"`
	FrameRate          *float64       `json:"frame_rate,omitempty"`
	NumInferenceSteps  *int           `json:"num_inference_steps,omitempty"`
	Seed               *int           `json:"seed,omitempty"`
	NegativePrompt     string         `json:"negative_prompt,omitempty"`
	ExtraBody          map[string]any `json:"extra_body,omitempty"`
}

type createResponse struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id,omitempty"`
	VideoID   string `json:"video_id,omitempty"`
	Object    string `json:"object"`
	Model     string `json:"model"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	CreatedAt int64  `json:"created_at"`
	Seconds   string `json:"seconds,omitempty"`
	Size      string `json:"size,omitempty"`
	Error     *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type pollResponse struct {
	ID          string         `json:"id"`
	TaskID      string         `json:"task_id,omitempty"`
	VideoID     string         `json:"video_id,omitempty"`
	Object      string         `json:"object"`
	Model       string         `json:"model"`
	Status      string         `json:"status"`
	Progress    int            `json:"progress"`
	CreatedAt   int64          `json:"created_at"`
	CompletedAt int64          `json:"completed_at,omitempty"`
	Seconds     string         `json:"seconds,omitempty"`
	Size        string         `json:"size,omitempty"`
	URL         string         `json:"url,omitempty"` // top-level CDN url (production Agnes responses)
	Metadata    map[string]any `json:"metadata,omitempty"`
	Usage       *struct {
		DurationSeconds float64 `json:"duration_seconds,omitempty"`
	} `json:"usage,omitempty"`
	Error *struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

type metadataOverrides struct {
	Image             string         `json:"image,omitempty"`
	Mode              string         `json:"mode,omitempty"`
	Width             *int           `json:"width,omitempty"`
	Height            *int           `json:"height,omitempty"`
	NumFrames         *int           `json:"num_frames,omitempty"`
	FrameRate         *float64       `json:"frame_rate,omitempty"`
	NumInferenceSteps *int           `json:"num_inference_steps,omitempty"`
	Seed              *int           `json:"seed,omitempty"`
	NegativePrompt    string         `json:"negative_prompt,omitempty"`
	ExtraBody         map[string]any `json:"extra_body,omitempty"`
}

// ============================
// Adaptor
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = info.ChannelBaseUrl
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if taskErr := relaycommon.ValidateMultipartDirect(c, info); taskErr != nil {
		return taskErr
	}

	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	if strings.TrimSpace(taskReq.Prompt) == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("field prompt is required"), "invalid_request", http.StatusBadRequest)
	}

	seconds := resolveSeconds(taskReq)
	if seconds <= 0 {
		seconds = DefaultSeconds
	}
	if seconds > relaycommon.MaxTaskDurationSeconds {
		return service.TaskErrorWrapperLocal(
			fmt.Errorf("seconds must be between 1 and %d", relaycommon.MaxTaskDurationSeconds),
			"invalid_seconds",
			http.StatusBadRequest,
		)
	}

	var meta metadataOverrides
	if taskReq.Metadata != nil {
		_ = taskcommon.UnmarshalMetadata(taskReq.Metadata, &meta)
	}
	if meta.NumFrames != nil {
		if err := validateNumFrames(*meta.NumFrames); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_num_frames", http.StatusBadRequest)
		}
	}
	if meta.FrameRate != nil {
		if err := validateFrameRate(*meta.FrameRate); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_frame_rate", http.StatusBadRequest)
		}
	}

	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	seconds := resolveSeconds(req)
	if seconds <= 0 {
		var meta metadataOverrides
		if req.Metadata != nil {
			_ = taskcommon.UnmarshalMetadata(req.Metadata, &meta)
		}
		frameRate := DefaultFrameRate
		if meta.FrameRate != nil && *meta.FrameRate > 0 {
			frameRate = *meta.FrameRate
		}
		if meta.NumFrames != nil && *meta.NumFrames > 0 && frameRate > 0 {
			seconds = int(float64(*meta.NumFrames) / frameRate)
		}
	}
	if seconds <= 0 {
		seconds = DefaultSeconds
	}
	return map[string]float64{
		"seconds": float64(seconds),
	}
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos", strings.TrimRight(a.baseURL, "/")), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	taskReq, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}
	upstream, err := convertToAgnesRequest(info, taskReq)
	if err != nil {
		return nil, err
	}
	body, err := common.Marshal(upstream)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_failed")
	}
	return bytes.NewReader(body), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		taskErr = service.TaskErrorWrapper(
			fmt.Errorf("upstream status %d: %s", resp.StatusCode, string(responseBody)),
			"upstream_error",
			resp.StatusCode,
		)
		return
	}

	var dResp createResponse
	if err := common.Unmarshal(responseBody, &dResp); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if dResp.Error != nil && dResp.Error.Message != "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("%s", dResp.Error.Message), "upstream_error", resp.StatusCode)
		return
	}

	upstreamID := strings.TrimSpace(dResp.ID)
	if upstreamID == "" {
		upstreamID = strings.TrimSpace(dResp.TaskID)
	}
	if upstreamID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}
	if strings.TrimSpace(dResp.VideoID) == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("video_id is empty"), "invalid_response", http.StatusInternalServerError)
		return
	}

	// Rewrite public id for clients; persist raw upstream body (keeps video_id).
	dResp.ID = info.PublicTaskID
	dResp.TaskID = info.PublicTaskID
	c.JSON(http.StatusOK, dResp)
	return upstreamID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	uri, err := buildFetchURL(baseUrl, body)
	if err != nil {
		return nil, err
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return doAgnesFetch(client, uri, key)
}

func doAgnesFetch(client *http.Client, uri, key string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var res pollResponse
	if err := common.Unmarshal(respBody, &res); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}

	taskResult := &relaycommon.TaskInfo{Code: 0}
	switch strings.ToLower(strings.TrimSpace(res.Status)) {
	case "queued", "pending":
		taskResult.Status = model.TaskStatusQueued
	case "processing", "in_progress":
		taskResult.Status = model.TaskStatusInProgress
	case "completed":
		taskResult.Status = model.TaskStatusSuccess
		taskResult.Progress = taskcommon.ProgressComplete
		taskResult.Url = extractCDNURL(res.URL, res.Metadata)
		if res.Usage != nil && res.Usage.DurationSeconds > 0 {
			taskResult.TotalTokens = int(res.Usage.DurationSeconds)
		} else if seconds := parseSeconds(res.Seconds); seconds > 0 {
			taskResult.TotalTokens = seconds
		}
	case "failed", "cancelled", "canceled":
		taskResult.Status = model.TaskStatusFailure
		taskResult.Progress = taskcommon.ProgressComplete
		if res.Error != nil && res.Error.Message != "" {
			taskResult.Reason = res.Error.Message
		} else {
			taskResult.Reason = "task failed"
		}
	default:
		// Keep empty status so callers can treat unrecognized payloads as errors
		// instead of silently resetting progress back to queued.
		if res.Error != nil && res.Error.Message != "" {
			taskResult.Status = model.TaskStatusFailure
			taskResult.Progress = taskcommon.ProgressComplete
			taskResult.Reason = res.Error.Message
		}
	}
	if res.Progress > 0 && res.Progress < 100 {
		taskResult.Progress = fmt.Sprintf("%d%%", res.Progress)
	}
	return taskResult, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	video := dto.NewOpenAIVideo()
	video.ID = task.TaskID
	video.Status = task.Status.ToVideoStatus()
	video.Model = task.Properties.OriginModelName
	video.SetProgressStr(task.Progress)
	video.CreatedAt = task.CreatedAt
	if task.FinishTime > 0 {
		video.CompletedAt = task.FinishTime
	} else {
		video.CompletedAt = task.UpdatedAt
	}

	var stored pollResponse
	_ = common.Unmarshal(task.Data, &stored)
	if stored.Seconds != "" {
		video.Seconds = stored.Seconds
	}
	if stored.Size != "" {
		video.Size = stored.Size
	}
	if stored.Metadata != nil {
		for k, v := range stored.Metadata {
			if k == "url" {
				continue
			}
			video.SetMetadata(k, v)
		}
	}
	if stored.Error != nil {
		video.Error = &dto.OpenAIVideoError{
			Code:    stored.Error.Code,
			Message: stored.Error.Message,
		}
	}

	// Prefer top-level url (production Agnes), then metadata.url (docs shape),
	// over a gateway /content proxy so Playground <video src> needs no auth.
	if previewURL := resolvePreviewURL(task, stored.URL, stored.Metadata); previewURL != "" {
		video.SetMetadata("url", previewURL)
	}

	return common.Marshal(video)
}

func (a *TaskAdaptor) GetModelList() []string { return ModelList }
func (a *TaskAdaptor) GetChannelName() string { return ChannelName }

// ============================
// Helpers
// ============================

// extractCDNURL prefers the top-level url field used by production Agnes
// responses, then falls back to metadata.url from the public docs shape.
func extractCDNURL(topLevelURL string, metadata map[string]any) string {
	if u := strings.TrimSpace(topLevelURL); u != "" {
		return u
	}
	if metadata == nil {
		return ""
	}
	switch v := metadata["url"].(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func isProxyContentURL(raw, taskID string) bool {
	raw = strings.TrimSpace(raw)
	taskID = strings.TrimSpace(taskID)
	if raw == "" || taskID == "" {
		return false
	}
	return strings.Contains(raw, "/v1/videos/"+taskID+"/content")
}

func resolvePreviewURL(task *model.Task, topLevelURL string, metadata map[string]any) string {
	cdn := extractCDNURL(topLevelURL, metadata)
	stored := strings.TrimSpace(task.PrivateData.ResultURL)

	if cdn != "" {
		return cdn
	}
	if stored != "" && !isProxyContentURL(stored, task.TaskID) {
		return stored
	}
	if stored != "" {
		return stored
	}
	return ""
}

func buildFetchURL(baseUrl string, body map[string]any) (string, error) {
	base := strings.TrimRight(baseUrl, "/")
	videoID, _ := body["video_id"].(string)
	videoID = strings.TrimSpace(videoID)
	if videoID == "" {
		return "", fmt.Errorf("video_id is required for Agnes Video polling")
	}
	q := url.Values{}
	q.Set("video_id", videoID)
	if modelName, _ := body["model"].(string); strings.TrimSpace(modelName) != "" {
		q.Set("model_name", strings.TrimSpace(modelName))
	}
	return fmt.Sprintf("%s/agnesapi?%s", base, q.Encode()), nil
}

func convertToAgnesRequest(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*createRequest, error) {
	var meta metadataOverrides
	if req.Metadata != nil {
		if err := taskcommon.UnmarshalMetadata(req.Metadata, &meta); err != nil {
			return nil, errors.Wrap(err, "unmarshal metadata failed")
		}
	}

	modelName := req.Model
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		modelName = info.UpstreamModelName
	}

	out := &createRequest{
		Model:  modelName,
		Prompt: strings.TrimSpace(req.Prompt),
	}

	image := strings.TrimSpace(meta.Image)
	if image == "" {
		image = strings.TrimSpace(req.Image)
	}
	if image == "" && len(req.Images) > 0 {
		image = strings.TrimSpace(req.Images[0])
	}
	if image == "" {
		image = strings.TrimSpace(req.InputReference)
	}
	out.Image = image

	mode := strings.TrimSpace(meta.Mode)
	if mode == "" {
		mode = strings.TrimSpace(req.Mode)
	}
	out.Mode = mode
	out.NegativePrompt = strings.TrimSpace(meta.NegativePrompt)
	out.NumInferenceSteps = meta.NumInferenceSteps
	out.Seed = meta.Seed
	out.ExtraBody = meta.ExtraBody

	width, height := resolveSize(req.Size, meta.Width, meta.Height)
	out.Width = common.GetPointer(width)
	out.Height = common.GetPointer(height)

	frameRate := DefaultFrameRate
	if meta.FrameRate != nil && *meta.FrameRate > 0 {
		frameRate = *meta.FrameRate
	}
	out.FrameRate = common.GetPointer(frameRate)

	numFrames := 0
	if meta.NumFrames != nil && *meta.NumFrames > 0 {
		numFrames = *meta.NumFrames
	} else {
		seconds := resolveSeconds(req)
		if seconds <= 0 {
			seconds = DefaultSeconds
		}
		numFrames = secondsToNumFrames(seconds, frameRate)
	}
	if err := validateNumFrames(numFrames); err != nil {
		return nil, err
	}
	if err := validateFrameRate(frameRate); err != nil {
		return nil, err
	}
	out.NumFrames = common.GetPointer(numFrames)
	return out, nil
}

func resolveSeconds(req relaycommon.TaskSubmitReq) int {
	if req.Duration > 0 {
		return req.Duration
	}
	if req.Seconds != "" {
		if v, err := strconv.Atoi(strings.TrimSpace(req.Seconds)); err == nil {
			return v
		}
	}
	return 0
}

func resolveSize(size string, metaW, metaH *int) (int, int) {
	if metaW != nil && *metaW > 0 && metaH != nil && *metaH > 0 {
		return *metaW, *metaH
	}
	size = strings.TrimSpace(strings.ToUpper(size))
	switch size {
	case "", "720P":
		return DefaultWidth, DefaultHeight
	case "1080P":
		return 1920, 1080
	case "480P":
		return 832, 448
	}
	if w, h, ok := parseWxH(size); ok {
		return w, h
	}
	return DefaultWidth, DefaultHeight
}

func parseWxH(size string) (int, int, bool) {
	parts := strings.Split(strings.ToLower(size), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}

func secondsToNumFrames(seconds int, frameRate float64) int {
	if seconds <= 0 {
		seconds = DefaultSeconds
	}
	if frameRate <= 0 {
		frameRate = DefaultFrameRate
	}
	raw := int(float64(seconds)*frameRate + 0.5)
	// Enforce 8n+1: round to nearest valid frame count within bounds.
	n := ((raw - 1 + 4) / 8) // nearest n for 8n+1 around raw
	frames := 8*n + 1
	if frames < 1 {
		frames = 1
	}
	if frames > MaxNumFrames {
		frames = MaxNumFrames
		// MaxNumFrames=441 already satisfies 8n+1 (441=8*55+1)
	}
	return frames
}

func validateNumFrames(n int) error {
	if n < 1 || n > MaxNumFrames {
		return fmt.Errorf("num_frames must be between 1 and %d", MaxNumFrames)
	}
	if (n-1)%8 != 0 {
		return fmt.Errorf("num_frames must follow 8n+1 rule")
	}
	return nil
}

func validateFrameRate(rate float64) error {
	if rate < MinFrameRate || rate > MaxFrameRate {
		return fmt.Errorf("frame_rate must be between %.0f and %.0f", MinFrameRate, MaxFrameRate)
	}
	return nil
}

func parseSeconds(raw string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}
	if v, err := strconv.Atoi(raw); err == nil {
		return v
	}
	if v, err := strconv.ParseFloat(raw, 64); err == nil {
		return int(v)
	}
	return 0
}
