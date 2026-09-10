package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/peakoffpeak"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperPeakOffPeak(t *testing.T) {
	gin.SetMode(gin.TestMode)
	common.QuotaPerUnit = 500000

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	cfg := peakoffpeak.DeepSeekV4FlashPreset()
	cfgJSON, err := common.Marshal(map[string]peakoffpeak.Config{
		"peak-test-model": cfg,
	})
	require.NoError(t, err)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":          `{"peak-test-model":"peak_offpeak"}`,
		"billing_setting.peak_offpeak_pricing": string(cfgJSON),
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	ctx.Request = req
	ctx.Set("group", "default")

	info := &relaycommon.RelayInfo{
		OriginModelName: "peak-test-model",
		UserGroup:       "default",
		UsingGroup:      "default",
	}

	priceData, err := ModelPriceHelper(ctx, info, 1_000_000, &types.TokenCountMeta{MaxTokens: 1_000_000})
	require.NoError(t, err)
	require.NotNil(t, info.PeakOffPeakSnapshot)
	assert.Equal(t, billing_setting.BillingModePeakOffPeak, info.PeakOffPeakSnapshot.BillingMode)
	assert.NotZero(t, info.PeakOffPeakSnapshot.EvalUnix)
	assert.Contains(t, []string{peakoffpeak.PeriodPeak, peakoffpeak.PeriodOffPeak}, info.PeakOffPeakSnapshot.EstimatedPeriod)
	assert.Greater(t, priceData.QuotaToPreConsume, 0)
}
