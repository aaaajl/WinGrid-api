package model

import (
	"context"

	"github.com/QuantumNous/new-api/common"
)

type RequestLog struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"index:idx_request_log_user_created,priority:1"`
	Username     string `json:"username" gorm:"size:64;default:''"`
	TokenId      int    `json:"token_id" gorm:"index:idx_request_log_token_created,priority:1;default:0"`
	TokenName    string `json:"token_name" gorm:"size:64;default:''"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64);index:idx_request_log_request_id;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;index:idx_request_log_user_created,priority:2;index:idx_request_log_token_created,priority:2;index:idx_request_log_created_at"`
	Method       string `json:"method" gorm:"size:16;default:''"`
	Path         string `json:"path" gorm:"size:512;default:''"`
	Query        string `json:"query" gorm:"type:text"`
	ContentType  string `json:"content_type" gorm:"size:128;default:''"`
	Headers      string `json:"headers" gorm:"type:text"`
	Body         string `json:"body" gorm:"type:text"`
	BodySize     int    `json:"body_size" gorm:"default:0"`
	BodyOmitted  bool   `json:"body_omitted"`
	ModelName    string `json:"model_name" gorm:"size:128;index;default:''"`
	Group        string `json:"group" gorm:"size:64;index;default:''"`
	ChannelId    int    `json:"channel_id" gorm:"index;default:0"`
	RelayFormat  string `json:"relay_format" gorm:"size:32;default:''"`
	StatusCode   int    `json:"status_code" gorm:"default:0"`
	Ip           string `json:"ip" gorm:"size:64;default:''"`
}

func (RequestLog) TableName() string {
	return "request_log"
}

func InsertRequestLog(entry *RequestLog) error {
	if entry == nil {
		return nil
	}
	return LOG_DB.Create(entry).Error
}

func DeleteOldRequestLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64

	for {
		if ctx.Err() != nil {
			return total, ctx.Err()
		}

		result := LOG_DB.Where("created_at < ?", targetTimestamp).Limit(limit).Delete(&RequestLog{})
		if result.Error != nil {
			return total, result.Error
		}

		total += result.RowsAffected
		if result.RowsAffected < int64(limit) {
			break
		}
	}

	return total, nil
}

func CleanupRequestLogByRetention(retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		return 0, nil
	}
	cutoff := common.GetTimestamp() - int64(retentionDays)*86400
	return DeleteOldRequestLog(context.Background(), cutoff, 100)
}
