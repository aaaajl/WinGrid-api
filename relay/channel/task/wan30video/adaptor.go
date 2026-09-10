package wan30video

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

const (
	defaultDuration   = 5
	defaultResolution = "1080P"
	defaultRatio      = "adaptive"
	maxPromptRunes    = 20000
)

type Wan30Request struct {
	Model      string          `json:"model"`
	Input      Wan30Input      `json:"input"`
	Parameters Wan30Parameters `json:"parameters"`
}

type Wan30Input struct {
	Prompt string       `json:"prompt,omitempty"`
	Media  []Wan30Media `json:"media,omitempty"`
}

type Wan30Media struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

type Wan30Parameters struct {
	Resolution   string `json:"resolution,omitempty"`
	Ratio        string `json:"ratio,omitempty"`
	Duration     int    `json:"duration"`
	Audio        *bool  `json:"audio,omitempty"`
	Seed         *int   `json:"seed,omitempty"`
	PromptExtend *bool  `json:"prompt_extend,omitempty"`
	Watermark    *bool  `json:"watermark,omitempty"`
}

type Wan30MetadataInput struct {
	Media *[]Wan30Media `json:"media,omitempty"`
}

type Wan30Metadata struct {
	Ratio        *string             `json:"ratio,omitempty"`
	Audio        *bool               `json:"audio,omitempty"`
	PromptExtend *bool               `json:"prompt_extend,omitempty"`
	Watermark    *bool               `json:"watermark,omitempty"`
	Seed         *int                `json:"seed,omitempty"`
	Media        *[]Wan30Media       `json:"media,omitempty"`
	Input        *Wan30MetadataInput `json:"input,omitempty"`
}

type Wan30Response struct {
	Output    Wan30Output `json:"output"`
	RequestID string      `json:"request_id"`
	Code      string      `json:"code,omitempty"`
	Message   string      `json:"message,omitempty"`
	Usage     *Wan30Usage `json:"usage,omitempty"`
}

type Wan30Output struct {
	TaskID        string `json:"task_id"`
	TaskStatus    string `json:"task_status"`
	SubmitTime    string `json:"submit_time,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	EndTime       string `json:"end_time,omitempty"`
	OrigPrompt    string `json:"orig_prompt,omitempty"`
	VideoURL      string `json:"video_url,omitempty"`
	Code          string `json:"code,omitempty"`
	Message       string `json:"message,omitempty"`
}

type Wan30Usage struct {
	VideoCount          int     `json:"video_count,omitempty"`
	Duration            float64 `json:"duration,omitempty"`
	InputVideoDuration  float64 `json:"input_video_duration,omitempty"`
	OutputVideoDuration float64 `json:"output_video_duration,omitempty"`
	FPS                 int     `json:"fps,omitempty"`
	SR                  int     `json:"SR,omitempty"`
	Ratio               string  `json:"ratio,omitempty"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	apiKey  string
	baseURL string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.apiKey = info.ApiKey
	a.baseURL = info.ChannelBaseUrl
}

func localTaskError(code, message string) *taskdto.TaskError {
	err := errors.New(message)
	return &taskdto.TaskError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusBadRequest,
		LocalError: true,
		Error:      err,
	}
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *taskdto.TaskError {
	var req relaycommon.TaskSubmitReq
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return localTaskError("invalid_json", err.Error())
	}
	if strings.TrimSpace(req.Model) == "" {
		return localTaskError("missing_model", "model field is required")
	}
	converted, normalized, err := convertToWan30Request(info, req)
	if err != nil {
		return localTaskError("invalid_wan30_request", err.Error())
	}
	if err := validateWan30Request(converted); err != nil {
		return localTaskError("invalid_wan30_request", err.Error())
	}

	info.Action = constant.TaskActionTextToVideo
	if len(converted.Input.Media) > 0 {
		info.Action = constant.TaskActionImageToVideo
	}
	c.Set("task_request", normalized)
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(_ *relaycommon.RelayInfo) (string, error) {
	return strings.TrimRight(a.baseURL, "/") + "/api/v1/services/aigc/video-generation/video-synthesis", nil
}

func (a *TaskAdaptor) BuildRequestHeader(_ *gin.Context, req *http.Request, _ *relaycommon.RelayInfo) error {
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-DashScope-Async", "enable")
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}
	wanReq, _, err := convertToWan30Request(info, req)
	if err != nil {
		return nil, errors.Wrap(err, "convert_to_wan30_request_failed")
	}
	if err := validateWan30Request(wanReq); err != nil {
		return nil, err
	}

	logger.LogJson(c, "wan 3.0 video request body", wanReq)
	body, err := common.Marshal(wanReq)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_wan30_request_failed")
	}
	return bytes.NewReader(body), nil
}

func convertToWan30Request(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*Wan30Request, relaycommon.TaskSubmitReq, error) {
	upstreamModel := req.Model
	if info.IsModelMapped {
		upstreamModel = info.UpstreamModelName
	}

	audio := true
	promptExtend := true
	watermark := false
	wanReq := &Wan30Request{
		Model: upstreamModel,
		Input: Wan30Input{
			Prompt: strings.TrimSpace(req.Prompt),
		},
		Parameters: Wan30Parameters{
			Resolution:   normalizeResolution(req.Size),
			Ratio:        defaultRatio,
			Duration:     req.Duration,
			Audio:        &audio,
			PromptExtend: &promptExtend,
			Watermark:    &watermark,
		},
	}
	if wanReq.Parameters.Resolution == "" {
		wanReq.Parameters.Resolution = defaultResolution
	}
	if wanReq.Parameters.Duration == 0 {
		wanReq.Parameters.Duration = defaultDuration
	}

	if req.Metadata != nil {
		if _, exists := req.Metadata["model"]; exists {
			return nil, req, fmt.Errorf("metadata must not override model")
		}
		var meta Wan30Metadata
		if err := taskcommon.UnmarshalMetadata(req.Metadata, &meta); err != nil {
			return nil, req, errors.Wrap(err, "unmarshal wan30 metadata failed")
		}
		if meta.Media != nil && meta.Input != nil && meta.Input.Media != nil {
			return nil, req, fmt.Errorf("metadata.media and metadata.input.media cannot both be set")
		}
		switch {
		case meta.Media != nil:
			wanReq.Input.Media = *meta.Media
		case meta.Input != nil && meta.Input.Media != nil:
			wanReq.Input.Media = *meta.Input.Media
		}
		if meta.Ratio != nil {
			wanReq.Parameters.Ratio = strings.TrimSpace(*meta.Ratio)
		}
		if meta.Audio != nil {
			wanReq.Parameters.Audio = meta.Audio
		}
		if meta.PromptExtend != nil {
			wanReq.Parameters.PromptExtend = meta.PromptExtend
		}
		if meta.Watermark != nil {
			wanReq.Parameters.Watermark = meta.Watermark
		}
		if meta.Seed != nil {
			wanReq.Parameters.Seed = meta.Seed
		}
	}

	req.Size = wanReq.Parameters.Resolution
	req.Duration = wanReq.Parameters.Duration
	return wanReq, req, nil
}

func normalizeResolution(value string) string {
	resolution := strings.ToUpper(strings.TrimSpace(value))
	if resolution != "" && !strings.HasSuffix(resolution, "P") {
		resolution += "P"
	}
	return resolution
}

func validateWan30Request(req *Wan30Request) error {
	if !strings.HasPrefix(strings.ToLower(req.Model), "wan3.0-video") {
		return fmt.Errorf("unsupported model %q", req.Model)
	}
	if utf8.RuneCountInString(req.Input.Prompt) > maxPromptRunes {
		return fmt.Errorf("prompt must not exceed %d characters", maxPromptRunes)
	}
	if req.Input.Prompt == "" && len(req.Input.Media) == 0 {
		return fmt.Errorf("prompt or media is required")
	}
	switch req.Parameters.Resolution {
	case "480P", "720P", "1080P":
	default:
		return fmt.Errorf("resolution must be 480P, 720P, or 1080P")
	}
	switch req.Parameters.Ratio {
	case "adaptive", "16:9", "4:3", "1:1", "3:4", "9:16":
	default:
		return fmt.Errorf("invalid ratio %q", req.Parameters.Ratio)
	}
	if req.Parameters.Duration < 2 || req.Parameters.Duration > 30 {
		return fmt.Errorf("duration must be between 2 and 30 seconds")
	}
	if req.Parameters.Seed != nil && (*req.Parameters.Seed < 0 || int64(*req.Parameters.Seed) > 2147483647) {
		return fmt.Errorf("seed must be between 0 and 2147483647")
	}
	return validateWan30Media(req.Input.Media)
}

func validateWan30Media(media []Wan30Media) error {
	counts := make(map[string]int)
	hasFrame := false
	hasRest := false
	for i := range media {
		item := &media[i]
		item.Type = strings.TrimSpace(item.Type)
		item.URL = strings.TrimSpace(item.URL)
		if item.Type == "" || item.URL == "" {
			return fmt.Errorf("media type and url are required")
		}
		switch item.Type {
		case "first_frame", "last_frame":
			hasFrame = true
		case "reference_image", "reference_video", "reference_audio", "file", "link":
			hasRest = true
		default:
			return fmt.Errorf("unsupported media type %q", item.Type)
		}
		counts[item.Type]++
		if err := validateWan30MediaURL(*item); err != nil {
			return err
		}
	}

	if hasFrame && hasRest {
		return fmt.Errorf("first_frame/last_frame cannot be combined with reference media, file, or link")
	}
	if counts["file"] > 0 && counts["link"] > 0 {
		return fmt.Errorf("file and link cannot be combined")
	}
	if counts["last_frame"] > 0 && counts["first_frame"] != 1 {
		return fmt.Errorf("last_frame requires first_frame")
	}
	limits := map[string]int{
		"first_frame": 1, "last_frame": 1, "reference_image": 10,
		"reference_video": 5, "reference_audio": 5, "file": 1, "link": 1,
	}
	for mediaType, limit := range limits {
		if counts[mediaType] > limit {
			return fmt.Errorf("%s accepts at most %d item(s)", mediaType, limit)
		}
	}
	return nil
}

func validateWan30MediaURL(item Wan30Media) error {
	lowerURL := strings.ToLower(item.URL)
	if strings.HasPrefix(lowerURL, "data:") {
		if item.Type != "first_frame" && item.Type != "last_frame" && item.Type != "reference_image" {
			return fmt.Errorf("data URLs are only supported for image media")
		}
		allowed := []string{"data:image/jpeg;", "data:image/jpg;", "data:image/png;", "data:image/bmp;", "data:image/webp;"}
		for _, prefix := range allowed {
			if strings.HasPrefix(lowerURL, prefix) {
				return nil
			}
		}
		return fmt.Errorf("unsupported image data URL")
	}

	parsed, err := url.Parse(item.URL)
	if err != nil {
		return fmt.Errorf("invalid media URL")
	}
	if item.Type == "link" && parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("link media requires an http or https URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" && parsed.Scheme != "oss" {
		return fmt.Errorf("media URL requires http, https, oss, or supported image data")
	}

	extension := strings.TrimPrefix(strings.ToLower(path.Ext(parsed.Path)), ".")
	if extension == "" {
		return nil
	}
	var allowed map[string]bool
	switch item.Type {
	case "file":
		allowed = map[string]bool{
			"docx": true, "doc": true, "xlsx": true, "xls": true, "pptx": true, "ppt": true,
			"pdf": true, "txt": true, "key": true, "pages": true, "numbers": true, "md": true,
		}
	case "reference_video":
		allowed = map[string]bool{"mp4": true, "mov": true}
	case "reference_audio":
		allowed = map[string]bool{"wav": true, "mp3": true}
	default:
		return nil
	}
	if !allowed[extension] {
		return fmt.Errorf("unsupported %s file extension .%s", item.Type, extension)
	}
	return nil
}

func (a *TaskAdaptor) EstimateBilling(c *gin.Context, _ *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}
	duration := req.Duration
	if duration < 2 || duration > 30 {
		return nil
	}
	return map[string]float64{"seconds": float64(duration)}
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) ParseResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*channel.TaskSubmitResponse, *taskdto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	_ = resp.Body.Close()

	var wanResp Wan30Response
	if err := common.Unmarshal(responseBody, &wanResp); err != nil {
		return nil, service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
	}
	if wanResp.Code != "" {
		status := resp.StatusCode
		if status < http.StatusBadRequest {
			status = http.StatusBadRequest
		}
		return nil, service.TaskErrorWrapper(fmt.Errorf("%s: %s", wanResp.Code, wanResp.Message), "wan30_api_error", status)
	}
	if wanResp.Output.TaskID == "" {
		return nil, service.TaskErrorWrapper(errors.New("task_id is empty"), "invalid_response", http.StatusInternalServerError)
	}

	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = info.PublicTaskID
	openAIResp.TaskID = info.PublicTaskID
	openAIResp.Model = info.OriginModelName
	openAIResp.Status = convertWan30Status(wanResp.Output.TaskStatus)
	openAIResp.CreatedAt = common.GetTimestamp()
	return &channel.TaskSubmitResponse{
		UpstreamTaskID: wanResp.Output.TaskID,
		TaskData:       responseBody,
		ClientResponse: openAIResp,
	}, nil
}

func (a *TaskAdaptor) FetchTask(baseURL, key string, task *model.Task, proxy string) (*http.Response, error) {
	taskID := strings.TrimSpace(task.GetUpstreamTaskID())
	if taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := strings.TrimRight(baseURL, "/") + "/api/v1/tasks/" + url.PathEscape(taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(_ *model.Task, _ *http.Response, respBody []byte) (*relaycommon.TaskInfo, error) {
	var wanResp Wan30Response
	if err := common.Unmarshal(respBody, &wanResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal wan30 task result failed")
	}
	result := &relaycommon.TaskInfo{Code: 0}
	switch wanResp.Output.TaskStatus {
	case "PENDING":
		result.Status = model.TaskStatusQueued
	case "RUNNING":
		result.Status = model.TaskStatusInProgress
	case "SUCCEEDED":
		result.Status = model.TaskStatusSuccess
		result.Url = wanResp.Output.VideoURL
	case "FAILED", "CANCELED", "UNKNOWN":
		result.Status = model.TaskStatusFailure
		switch {
		case wanResp.Output.Message != "":
			result.Reason = wanResp.Output.Message
		case wanResp.Message != "":
			result.Reason = wanResp.Message
		case wanResp.Output.TaskStatus == "UNKNOWN":
			result.Reason = "task is unknown or expired"
		default:
			result.Reason = "task failed"
		}
	default:
		result.Status = model.TaskStatusQueued
	}
	return result, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	var wanResp Wan30Response
	if err := common.Unmarshal(task.Data, &wanResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal wan30 response failed")
	}
	openAIResp := dto.NewOpenAIVideo()
	openAIResp.ID = task.TaskID
	openAIResp.Status = convertWan30Status(wanResp.Output.TaskStatus)
	openAIResp.Model = task.Properties.OriginModelName
	openAIResp.SetProgressStr(task.Progress)
	openAIResp.CreatedAt = task.CreatedAt
	openAIResp.CompletedAt = task.UpdatedAt
	videoURL := wanResp.Output.VideoURL
	if videoURL == "" {
		videoURL = task.GetResultURL()
	}
	if videoURL != "" {
		openAIResp.SetMetadata("url", videoURL)
	}
	if wanResp.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{Code: wanResp.Code, Message: wanResp.Message}
	} else if wanResp.Output.Code != "" {
		openAIResp.Error = &dto.OpenAIVideoError{Code: wanResp.Output.Code, Message: wanResp.Output.Message}
	}
	return common.Marshal(openAIResp)
}

func convertWan30Status(status string) string {
	switch status {
	case "PENDING":
		return dto.VideoStatusQueued
	case "RUNNING":
		return dto.VideoStatusInProgress
	case "SUCCEEDED":
		return dto.VideoStatusCompleted
	case "FAILED", "CANCELED", "UNKNOWN":
		return dto.VideoStatusFailed
	default:
		return dto.VideoStatusUnknown
	}
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}
