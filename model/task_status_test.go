package model

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

func TestTaskStatusToVideoStatus(t *testing.T) {
	tests := []struct {
		status TaskStatus
		want   string
	}{
		{TaskStatusNotStart, dto.VideoStatusQueued},
		{TaskStatusSubmitted, dto.VideoStatusQueued},
		{TaskStatusQueued, dto.VideoStatusQueued},
		{TaskStatusInProgress, dto.VideoStatusInProgress},
		{TaskStatusSuccess, dto.VideoStatusCompleted},
		{TaskStatusFailure, dto.VideoStatusFailed},
		{TaskStatusUnknown, dto.VideoStatusUnknown},
		{TaskStatus("SOMETHING_ELSE"), dto.VideoStatusUnknown},
	}

	for _, tc := range tests {
		t.Run(string(tc.status), func(t *testing.T) {
			assert.Equal(t, tc.want, tc.status.ToVideoStatus())
		})
	}
}
