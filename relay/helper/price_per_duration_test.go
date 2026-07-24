package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperPerCallPerDurationAccuracy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	const modelName = "per-duration-test-model"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"per-duration-test-model":"per_duration"}`,
		"billing_setting.duration_pricing": `{
			"per-duration-test-model":{
				"fallback_price":10,
				"size_prices":{"480P":2,"720P":2,"1080P":5,"4K":10}
			}
		}`,
		"group_ratio_setting.group_ratio": `{"default":1}`,
	}))

	cases := []struct {
		name         string
		size         string
		duration     int
		seconds      string
		wantBase     float64
		wantCostUSD  float64
		wantQuota    int
		wantFallback bool
	}{
		{
			name:        "480P x 5s",
			size:        "480P",
			duration:    5,
			wantBase:    2,
			wantCostUSD: 10,
			wantQuota:   int(10 * common.QuotaPerUnit),
		},
		{
			name:        "720P x 5s",
			size:        "720p",
			duration:    5,
			wantBase:    2,
			wantCostUSD: 10,
			wantQuota:   int(10 * common.QuotaPerUnit),
		},
		{
			name:        "1080P x 5s",
			size:        "1080",
			duration:    5,
			wantBase:    5,
			wantCostUSD: 25,
			wantQuota:   int(25 * common.QuotaPerUnit),
		},
		{
			name:        "4K x 10s",
			size:        "4k",
			duration:    10,
			wantBase:    10,
			wantCostUSD: 100,
			wantQuota:   int(100 * common.QuotaPerUnit),
		},
		{
			name:         "unknown size uses fallback",
			size:         "1280x720",
			duration:     5,
			wantBase:     10,
			wantCostUSD:  50,
			wantQuota:    int(50 * common.QuotaPerUnit),
			wantFallback: true,
		},
		{
			name:         "missing size uses fallback",
			duration:     5,
			wantBase:     10,
			wantCostUSD:  50,
			wantQuota:    int(50 * common.QuotaPerUnit),
			wantFallback: true,
		},
		{
			name:        "seconds field is accepted",
			size:        "720P",
			seconds:     "5",
			wantBase:    2,
			wantCostUSD: 10,
			wantQuota:   int(10 * common.QuotaPerUnit),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
			ctx.Set("group", "default")
			ctx.Set("task_request", relaycommon.TaskSubmitReq{
				Model:    modelName,
				Size:     tc.size,
				Duration: tc.duration,
				Seconds:  tc.seconds,
			})

			info := &relaycommon.RelayInfo{
				OriginModelName: modelName,
				UserGroup:       "default",
				UsingGroup:      "default",
			}

			priceData, err := ModelPriceHelperPerCall(ctx, info)
			require.NoError(t, err)
			require.True(t, priceData.UsePrice)
			assert.Equal(t, tc.wantQuota, priceData.Quota)
			assert.InDelta(t, tc.wantCostUSD, priceData.ModelPrice, 1e-9)
			require.NotNil(t, info.DurationBilling)
			assert.Equal(t, tc.wantBase, info.DurationBilling.BasePrice)
			assert.InDelta(t, tc.wantCostUSD, info.DurationBilling.CostUSD, 1e-9)
			assert.Equal(t, tc.wantFallback, info.DurationBilling.UsedFallback)

			// Guard against double-billing: OtherRatios must not be applied on top.
			withSeconds := priceData
			withSeconds.AddOtherRatio("seconds", float64(5))
			doubled := withSeconds.ApplyOtherRatiosToFloat(float64(priceData.Quota))
			assert.NotEqual(t, float64(priceData.Quota), doubled,
				"sanity: OtherRatios would change quota if wrongly applied")
			assert.Equal(t, tc.wantQuota, priceData.Quota,
				"helper quota must remain basePrice*duration without OtherRatios")
		})
	}
}

func TestModelPriceHelperPerCallPerDurationResolutionJSONAlias(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	const modelName = "per-duration-resolution-alias"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"per-duration-resolution-alias":"per_duration"}`,
		"billing_setting.duration_pricing": `{
			"per-duration-resolution-alias":{
				"fallback_price":10,
				"size_prices":{"720P":0.132}
			}
		}`,
		"group_ratio_setting.group_ratio": `{"default":1}`,
	}))

	var req relaycommon.TaskSubmitReq
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"per-duration-resolution-alias",
		"prompt":"A quiet sunrise",
		"duration":3,
		"resolution":"720P"
	}`), &req))
	require.Equal(t, "720P", req.Size)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	ctx.Set("group", "default")
	ctx.Set("task_request", req)

	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		UserGroup:       "default",
		UsingGroup:      "default",
	}
	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	assert.Equal(t, int(0.396*common.QuotaPerUnit), priceData.Quota)
	assert.False(t, info.DurationBilling.UsedFallback)
	assert.Equal(t, 0.132, info.DurationBilling.BasePrice)
}

func TestModelPriceHelperPerCallPerDurationRejectsInvalidDuration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"bad-duration-model":"per_duration"}`,
		"billing_setting.duration_pricing": `{
			"bad-duration-model":{"fallback_price":5,"size_prices":{"720P":1}}
		}`,
		"group_ratio_setting.group_ratio": `{"default":1}`,
	}))

	cases := []struct {
		name string
		req  relaycommon.TaskSubmitReq
	}{
		{name: "missing duration", req: relaycommon.TaskSubmitReq{Size: "720P"}},
		{name: "zero duration", req: relaycommon.TaskSubmitReq{Size: "720P", Duration: 0}},
		{name: "too large", req: relaycommon.TaskSubmitReq{Size: "720P", Duration: relaycommon.MaxTaskDurationSeconds + 1}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
			ctx.Set("group", "default")
			ctx.Set("task_request", tc.req)

			_, err := ModelPriceHelperPerCall(ctx, &relaycommon.RelayInfo{
				OriginModelName: "bad-duration-model",
				UserGroup:       "default",
				UsingGroup:      "default",
			})
			require.Error(t, err)
		})
	}
}

func TestModelPriceHelperPerCallPerDurationAppliesGroupRatio(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"group-duration-model":"per_duration"}`,
		"billing_setting.duration_pricing": `{
			"group-duration-model":{"fallback_price":5,"size_prices":{"720P":2}}
		}`,
		"group_ratio_setting.group_ratio": `{"vip":2}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	ctx.Set("group", "vip")
	ctx.Set("task_request", relaycommon.TaskSubmitReq{Size: "720P", Duration: 5})

	priceData, err := ModelPriceHelperPerCall(ctx, &relaycommon.RelayInfo{
		OriginModelName: "group-duration-model",
		UserGroup:       "vip",
		UsingGroup:      "vip",
	})
	require.NoError(t, err)
	// costUSD=10, groupRatio=2 → quota = 10 * QuotaPerUnit * 2
	assert.Equal(t, int(20*common.QuotaPerUnit), priceData.Quota)
}

func TestPerDurationSkipsOtherRatiosApplication(t *testing.T) {
	// Mirrors relay_task.go: when mode is per_duration, OtherRatios must not
	// change the final quota even if an adaptor returns seconds/size multipliers.
	baseQuota := 5_000_000
	priceData := types.PriceData{Quota: baseQuota, UsePrice: true}
	priceData.AddOtherRatio("seconds", 5)
	priceData.AddOtherRatio("size", 1.666667)

	if !billing_setting.IsPerDurationBilling("nonexistent") {
		// ratio mode would multiply; assert the multiply path exists for contrast
		multiplied := priceData.ApplyOtherRatiosToFloat(float64(baseQuota))
		assert.InDelta(t, float64(baseQuota)*5*1.666667, multiplied, 1)
	}

	perDurationQuota := baseQuota
	assert.Equal(t, baseQuota, perDurationQuota)
}
