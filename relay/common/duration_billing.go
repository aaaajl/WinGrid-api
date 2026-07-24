package common

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/pkg/durationbilling"
)

// ResolveTaskBillingDuration returns the positive duration (seconds) used for
// per_duration billing. Priority: Duration → Seconds → metadata.duration/seconds.
func ResolveTaskBillingDuration(req TaskSubmitReq) (int, error) {
	if req.Duration > 0 {
		return req.Duration, nil
	}
	if secondsStr := strings.TrimSpace(req.Seconds); secondsStr != "" {
		seconds, err := strconv.Atoi(secondsStr)
		if err != nil {
			return 0, fmt.Errorf("invalid seconds value")
		}
		if seconds > 0 {
			return seconds, nil
		}
	}
	if req.Metadata != nil {
		if v, ok := metadataInt(req.Metadata, "duration"); ok && v > 0 {
			return v, nil
		}
		if v, ok := metadataInt(req.Metadata, "seconds"); ok && v > 0 {
			return v, nil
		}
	}
	return 0, fmt.Errorf("duration is required for per_duration billing")
}

// ResolveTaskBillingSize returns the normalized size key for price lookup.
// Priority: Size → metadata.resolution → metadata.size. Empty size is allowed
// (caller uses fallback price). Top-level JSON "resolution" is folded into Size
// by TaskSubmitReq.UnmarshalJSON.
func ResolveTaskBillingSize(req TaskSubmitReq) string {
	if size := strings.TrimSpace(req.Size); size != "" {
		return durationbilling.NormalizeSizeKey(size)
	}
	if req.Metadata != nil {
		if v, ok := metadataString(req.Metadata, "resolution"); ok {
			return durationbilling.NormalizeSizeKey(v)
		}
		if v, ok := metadataString(req.Metadata, "size"); ok {
			return durationbilling.NormalizeSizeKey(v)
		}
	}
	return ""
}

func metadataInt(meta map[string]interface{}, key string) (int, bool) {
	raw, ok := meta[key]
	if !ok || raw == nil {
		return 0, false
	}
	switch v := raw.(type) {
	case int:
		return v, true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	case float32:
		return int(v), true
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return 0, false
		}
		return n, true
	default:
		return 0, false
	}
}

func metadataString(meta map[string]interface{}, key string) (string, bool) {
	raw, ok := meta[key]
	if !ok || raw == nil {
		return "", false
	}
	switch v := raw.(type) {
	case string:
		s := strings.TrimSpace(v)
		return s, s != ""
	default:
		return "", false
	}
}
