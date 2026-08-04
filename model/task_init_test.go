package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	commonRelay "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestInitTask_PersistsApiKeyForMultiKeyChannel(t *testing.T) {
	info := &commonRelay.RelayInfo{
		UserId:     1,
		UsingGroup: "default",
		ChannelMeta: &commonRelay.ChannelMeta{
			ChannelId:         29,
			ChannelType:       constant.ChannelTypeMiniMax,
			ChannelIsMultiKey: true,
			ApiKey:            "selected-minimax-key",
		},
	}

	task := InitTask(constant.TaskPlatformMiniMaxV2, info)
	require.Equal(t, "selected-minimax-key", task.PrivateData.Key)
	require.Equal(t, 29, task.ChannelId)
}

func TestInitTask_PersistsApiKeyForGemini(t *testing.T) {
	info := &commonRelay.RelayInfo{
		UserId:     1,
		UsingGroup: "default",
		ChannelMeta: &commonRelay.ChannelMeta{
			ChannelId:   1,
			ChannelType: constant.ChannelTypeGemini,
			ApiKey:      "gemini-key",
		},
	}

	task := InitTask(constant.TaskPlatform("google-video"), info)
	require.Equal(t, "gemini-key", task.PrivateData.Key)
}

func TestInitTask_DoesNotPersistApiKeyForSingleKeyChannel(t *testing.T) {
	info := &commonRelay.RelayInfo{
		UserId:     1,
		UsingGroup: "default",
		ChannelMeta: &commonRelay.ChannelMeta{
			ChannelId:         1,
			ChannelType:       constant.ChannelTypeMiniMax,
			ChannelIsMultiKey: false,
			ApiKey:            "single-key",
		},
	}

	task := InitTask(constant.TaskPlatformMiniMaxV2, info)
	require.Empty(t, task.PrivateData.Key)
}
