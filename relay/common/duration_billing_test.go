package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveTaskBillingDuration(t *testing.T) {
	n, err := ResolveTaskBillingDuration(TaskSubmitReq{Duration: 7})
	require.NoError(t, err)
	assert.Equal(t, 7, n)

	n, err = ResolveTaskBillingDuration(TaskSubmitReq{Seconds: "9"})
	require.NoError(t, err)
	assert.Equal(t, 9, n)

	n, err = ResolveTaskBillingDuration(TaskSubmitReq{
		Metadata: map[string]interface{}{"duration": float64(4)},
	})
	require.NoError(t, err)
	assert.Equal(t, 4, n)

	_, err = ResolveTaskBillingDuration(TaskSubmitReq{})
	require.Error(t, err)
}

func TestResolveTaskBillingSize(t *testing.T) {
	assert.Equal(t, "1080P", ResolveTaskBillingSize(TaskSubmitReq{Size: "1080"}))
	assert.Equal(t, "720P", ResolveTaskBillingSize(TaskSubmitReq{
		Metadata: map[string]interface{}{"resolution": "720p"},
	}))
	assert.Equal(t, "", ResolveTaskBillingSize(TaskSubmitReq{}))
}
