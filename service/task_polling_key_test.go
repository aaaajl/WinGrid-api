package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestResolveTaskPollingKey_PrefersStoredKey(t *testing.T) {
	ch := &model.Channel{
		Key: "key-a\nkey-b",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}
	task := &model.Task{
		PrivateData: model.TaskPrivateData{Key: "stored-key"},
	}

	require.Equal(t, "stored-key", resolveTaskPollingKey(ch, task))
}

func TestResolveTaskPollingKey_FallsBackToFirstMultiKey(t *testing.T) {
	ch := &model.Channel{
		Key: "key-a\nkey-b",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
		},
	}
	task := &model.Task{}

	require.Equal(t, "key-a", resolveTaskPollingKey(ch, task))
}

func TestResolveTaskPollingKey_SingleKeyChannel(t *testing.T) {
	ch := &model.Channel{Key: "only-key"}
	task := &model.Task{}

	require.Equal(t, "only-key", resolveTaskPollingKey(ch, task))
}
