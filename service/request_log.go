package service

import (
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/request_log_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func ShouldRecordMidjourneyRequestLog(relayMode int) bool {
	switch relayMode {
	case relayconstant.RelayModeMidjourneyNotify,
		relayconstant.RelayModeMidjourneyTaskFetch,
		relayconstant.RelayModeMidjourneyTaskFetchByCondition,
		relayconstant.RelayModeMidjourneyTaskImageSeed:
		return false
	default:
		return true
	}
}

func MaybeRecordRequestLog(c *gin.Context, relayFormat string) {
	if c == nil || c.Request == nil {
		return
	}
	settings := request_log_setting.GetSetting()
	if !settings.Enabled {
		return
	}

	entry := buildRequestLogEntry(c, relayFormat, settings)
	if entry == nil {
		return
	}

	gopool.Go(func() {
		if err := model.InsertRequestLog(entry); err != nil {
			common.SysLog("failed to insert request_log: " + err.Error())
		}
	})
}

func buildRequestLogEntry(c *gin.Context, relayFormat string, settings request_log_setting.RequestLogSetting) *model.RequestLog {
	userId := c.GetInt("id")
	if userId == 0 {
		return nil
	}

	bodyBytes, bodySize, readErr := readRequestBodyBytes(c)
	if readErr != nil {
		common.SysLog("request_log read body failed: " + readErr.Error())
	}

	body, bodyOmitted := resolveRequestLogBody(bodyBytes, bodySize, settings.MaxBodyKB)
	headersJSON := ""
	if settings.StoreHeaders {
		headersJSON = redactRequestHeaders(c, settings.RedactHeaders)
	}

	ip := ""
	if settingMap, err := model.GetUserSetting(userId, false); err == nil && settingMap.RecordIpLog {
		ip = c.ClientIP()
	}

	path := ""
	query := ""
	method := ""
	contentType := ""
	if c.Request.URL != nil {
		path = c.Request.URL.Path
		query = c.Request.URL.RawQuery
	}
	if c.Request.Method != "" {
		method = c.Request.Method
	}
	contentType = c.Request.Header.Get("Content-Type")

	statusCode := c.Writer.Status()
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	return &model.RequestLog{
		UserId:      userId,
		Username:    c.GetString("username"),
		TokenId:     c.GetInt("token_id"),
		TokenName:   c.GetString("token_name"),
		RequestId:   c.GetString(common.RequestIdKey),
		CreatedAt:   common.GetTimestamp(),
		Method:      method,
		Path:        path,
		Query:       query,
		ContentType: contentType,
		Headers:     headersJSON,
		Body:        body,
		BodySize:    bodySize,
		BodyOmitted: bodyOmitted,
		ModelName:   c.GetString(string(constant.ContextKeyOriginalModel)),
		Group:       c.GetString(string(constant.ContextKeyUsingGroup)),
		ChannelId:   c.GetInt("channel_id"),
		RelayFormat: relayFormat,
		StatusCode:  statusCode,
		Ip:          ip,
	}
}

func readRequestBodyBytes(c *gin.Context) ([]byte, int, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, 0, err
	}
	size := int(storage.Size())
	if size <= 0 {
		return nil, 0, nil
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		return nil, size, err
	}
	return bodyBytes, len(bodyBytes), nil
}

func resolveRequestLogBody(bodyBytes []byte, bodySize int, maxBodyKB int) (body string, omitted bool) {
	if maxBodyKB <= 0 {
		return "", true
	}
	if bodySize <= 0 || len(bodyBytes) == 0 {
		return "", false
	}
	if bodySize > maxBodyKB*1024 {
		return "", true
	}
	return string(bodyBytes), false
}

func redactRequestHeaders(c *gin.Context, redactList string) string {
	headerMap := make(map[string]interface{})
	redactNames := parseRedactHeaderNames(redactList)

	for key, values := range c.Request.Header {
		canonicalKey := http.CanonicalHeaderKey(key)
		value := strings.Join(values, ",")
		if shouldRedactHeader(canonicalKey, redactNames) {
			value = "[REDACTED]"
		}
		headerMap[canonicalKey] = value
	}

	return common.MapToJsonStr(headerMap)
}

func parseRedactHeaderNames(redactList string) map[string]struct{} {
	names := make(map[string]struct{})
	for _, part := range strings.Split(redactList, ",") {
		name := strings.TrimSpace(part)
		if name == "" {
			continue
		}
		names[strings.ToLower(name)] = struct{}{}
	}
	return names
}

func shouldRedactHeader(headerName string, redactNames map[string]struct{}) bool {
	lowerName := strings.ToLower(headerName)
	if _, ok := redactNames[lowerName]; ok {
		return true
	}
	if strings.HasSuffix(lowerName, "-key") || strings.HasSuffix(lowerName, "_key") {
		return true
	}
	return false
}

func StartRequestLogCleanupTask() {
	go func() {
		cleanupExpiredRequestLogs()
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupExpiredRequestLogs()
		}
	}()
}

func cleanupExpiredRequestLogs() {
	settings := request_log_setting.GetSetting()
	if settings.RetentionDays <= 0 {
		return
	}
	count, err := model.CleanupRequestLogByRetention(settings.RetentionDays)
	if err != nil {
		common.SysLog("failed to cleanup request_log: " + err.Error())
		return
	}
	if count > 0 {
		common.SysLog("cleaned up request_log entries: " + common.Interface2String(count))
	}
}
