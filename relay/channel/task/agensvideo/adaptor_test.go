package agensvideo

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildFetchURL_RequiresVideoID(t *testing.T) {
	uri, err := buildFetchURL("https://api.agnes-ai.cn/", map[string]any{
		"video_id": "video_abc",
		"task_id":  "task_ignored",
		"model":    "agnes-video-v2.0",
	})
	require.NoError(t, err)
	assert.Equal(t, "https://api.agnes-ai.cn/agnesapi?model_name=agnes-video-v2.0&video_id=video_abc", uri)
}

func TestBuildFetchURL_RejectsTaskIDOnly(t *testing.T) {
	_, err := buildFetchURL("https://api.agnes-ai.cn", map[string]any{
		"task_id": "task_legacy",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "video_id")
}

func TestBuildFetchURL_MissingIDs(t *testing.T) {
	_, err := buildFetchURL("https://api.agnes-ai.cn", map[string]any{})
	require.Error(t, err)
}

func TestParseTaskResult_CompletedSetsCDNURL(t *testing.T) {
	body := []byte(`{
		"id":"task_x","status":"completed","progress":100,
		"metadata":{"url":"https://platform-outputs.agnes-ai.space/videos/a.mp4","size_mapping":{"ratio":"16:9"}}
	}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), info.Status)
	assert.Equal(t, "100%", info.Progress)
	assert.Equal(t, "https://platform-outputs.agnes-ai.space/videos/a.mp4", info.Url)
}

func TestParseTaskResult_CompletedPrefersTopLevelURL(t *testing.T) {
	body := []byte(`{
		"id":"video_e23e","status":"completed","progress":100,
		"url":"https://cos-platform-outputs.agnes-ai.cn/videos/a.mp4",
		"metadata":{"url":"https://platform-outputs.agnes-ai.space/videos/ignored.mp4"}
	}`)
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult(body)
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), info.Status)
	assert.Equal(t, "https://cos-platform-outputs.agnes-ai.cn/videos/a.mp4", info.Url)
}

func TestParseTaskResult_QueuedAndFailed(t *testing.T) {
	a := &TaskAdaptor{}

	info, err := a.ParseTaskResult([]byte(`{"status":"queued","progress":0}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusQueued), info.Status)

	info, err = a.ParseTaskResult([]byte(`{"status":"failed","error":{"message":"boom","code":"x"}}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusFailure), info.Status)
	assert.Equal(t, "boom", info.Reason)
	assert.Equal(t, "100%", info.Progress)
}

func TestParseTaskResult_CompletedSetsProgress(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{
		"status":"completed","progress":100,
		"metadata":{"url":"https://cdn.example.com/a.mp4"}
	}`))
	require.NoError(t, err)
	assert.Equal(t, string(model.TaskStatusSuccess), info.Status)
	assert.Equal(t, "100%", info.Progress)
	assert.Equal(t, "https://cdn.example.com/a.mp4", info.Url)
}

func TestParseTaskResult_UnrecognizedStatusWithoutErrorStaysEmpty(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{"progress":0}`))
	require.NoError(t, err)
	assert.Equal(t, "", info.Status)
}

func TestFetchTask_UsesVideoIDOnly(t *testing.T) {
	var hitAgnesAPI, hitLegacy bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/agnesapi"):
			hitAgnesAPI = true
			require.Equal(t, "video_abc", r.URL.Query().Get("video_id"))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"completed","progress":100,"metadata":{"url":"https://cdn.example.com/a.mp4"}}`))
		case strings.HasPrefix(r.URL.Path, "/v1/videos/"):
			hitLegacy = true
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"completed"}`))
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "secret", map[string]any{
		"video_id": "video_abc",
		"task_id":  "task_legacy",
		"model":    "agnes-video-v2.0",
	}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.True(t, hitAgnesAPI)
	require.False(t, hitLegacy)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestFetchTask_RequiresVideoID(t *testing.T) {
	_, err := (&TaskAdaptor{}).FetchTask("https://api.agnes-ai.cn", "secret", map[string]any{
		"task_id": "task_legacy",
	}, "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "video_id")
}

func TestConvertToOpenAIVideo_InjectsMetadataURL(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID: "task_public",
		Status: model.TaskStatusSuccess,
		Progress: "100%",
		Properties: model.Properties{OriginModelName: "agnes-video-v2.0"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://cdn.example.com/v.mp4",
		},
		Data: json.RawMessage(`{"seconds":"5.0","size":"1152x768","metadata":{"size_mapping":{"ratio":"16:9"}}}`),
	}
	out, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var video dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(out, &video))
	assert.Equal(t, "task_public", video.ID)
	assert.Equal(t, dto.VideoStatusCompleted, video.Status)
	assert.Equal(t, "https://cdn.example.com/v.mp4", video.Metadata["url"])
	assert.Equal(t, "5.0", video.Seconds)
	assert.Equal(t, "1152x768", video.Size)
	assert.NotNil(t, video.Metadata["size_mapping"])
}

func TestConvertToOpenAIVideo_PrefersCDNOverProxy(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_public",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Properties: model.Properties{OriginModelName: "agnes-video-v2.0"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://gateway.example.com/v1/videos/task_public/content",
		},
		Data: json.RawMessage(`{
			"status":"completed",
			"metadata":{"url":"https://platform-outputs.agnes-ai.space/videos/a.mp4"}
		}`),
	}
	out, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var video dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(out, &video))
	assert.Equal(t, "https://platform-outputs.agnes-ai.space/videos/a.mp4", video.Metadata["url"])
}

func TestConvertToOpenAIVideo_PrefersTopLevelURL(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_public",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		Properties: model.Properties{OriginModelName: "agnes-video-v2.0"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://gateway.example.com/v1/videos/task_public/content",
		},
		Data: json.RawMessage(`{
			"status":"completed",
			"url":"https://cos-platform-outputs.agnes-ai.cn/videos/a.mp4",
			"metadata":{"size_mapping":{"ratio":"16:9"}}
		}`),
	}
	out, err := a.ConvertToOpenAIVideo(task)
	require.NoError(t, err)

	var video dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(out, &video))
	assert.Equal(t, "https://cos-platform-outputs.agnes-ai.cn/videos/a.mp4", video.Metadata["url"])
}

func TestValidateNumFrames(t *testing.T) {
	require.NoError(t, validateNumFrames(121))
	require.Error(t, validateNumFrames(120))
	require.Error(t, validateNumFrames(0))
	require.Error(t, validateNumFrames(MaxNumFrames+1))
}

func TestSecondsToNumFrames(t *testing.T) {
	assert.Equal(t, 121, secondsToNumFrames(5, 24))
	assert.Equal(t, 241, secondsToNumFrames(10, 24))
	assert.Equal(t, MaxNumFrames, secondsToNumFrames(100, 24))
}

func TestConvertToAgnesRequest_Defaults(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "agnes-video-v2.0",
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt:   "a cat on the beach",
		Duration: 5,
		Size:     "720P",
	}
	out, err := convertToAgnesRequest(info, req)
	require.NoError(t, err)
	require.NotNil(t, out.Width)
	require.NotNil(t, out.Height)
	require.NotNil(t, out.NumFrames)
	require.NotNil(t, out.FrameRate)
	assert.Equal(t, "agnes-video-v2.0", out.Model)
	assert.Equal(t, DefaultWidth, *out.Width)
	assert.Equal(t, DefaultHeight, *out.Height)
	assert.Equal(t, 121, *out.NumFrames)
	assert.Equal(t, DefaultFrameRate, *out.FrameRate)
}

func TestEstimateBilling_UsesDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt:   "x",
		Duration: 8,
	})

	ratios := (&TaskAdaptor{}).EstimateBilling(c, &relaycommon.RelayInfo{})
	require.Equal(t, 8.0, ratios["seconds"])
}

func TestExtractUpstreamVideoID_Compat(t *testing.T) {
	assert.Equal(t, "video_abc", model.ExtractUpstreamVideoID([]byte(`{"id":"task_1","video_id":"video_abc"}`)))
	assert.Equal(t, "", model.ExtractUpstreamVideoID([]byte(`{"id":"task_1"}`)))
	assert.Equal(t, "", model.ExtractUpstreamVideoID(nil))
}
