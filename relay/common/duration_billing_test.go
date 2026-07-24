package common

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestTaskSubmitReq_ResolutionAliasToSize(t *testing.T) {
	var req TaskSubmitReq
	require.NoError(t, common.Unmarshal([]byte(`{
		"prompt":"hi","model":"happyhorse-1.1-t2v",
		"duration":3,"resolution":"720P"
	}`), &req))
	assert.Equal(t, "720P", req.Size)
	assert.Equal(t, "720P", ResolveTaskBillingSize(req))

	// size wins when both are present
	req = TaskSubmitReq{}
	require.NoError(t, common.Unmarshal([]byte(`{
		"prompt":"hi","size":"1080P","resolution":"720P"
	}`), &req))
	assert.Equal(t, "1080P", req.Size)
}
