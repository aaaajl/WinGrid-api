package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func saveAndRestorePerCharsConfig(t *testing.T) {
	t.Helper()
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
}

func perCharsTestInfo(modelName, group string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: modelName,
		UserGroup:       group,
		UsingGroup:      group,
	}
}

func TestModelPriceHelperPerCharsPreConsumeFromRequestText(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = previousQuotaPerUnit })

	saveAndRestorePerCharsConfig(t)

	const modelName = "per-chars-test-model"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":      `{"per-chars-test-model":"per_chars"}`,
		"billing_setting.per_chars_pricing": `{"per-chars-test-model":{"price_per_10k_chars":1}}`,
		"group_ratio_setting.group_ratio":   `{"default":1}`,
	}))

	cases := []struct {
		name      string
		text      string
		wantChars int
		wantQuota int
	}{
		{name: "full unit", text: strings.Repeat("a", 10000), wantChars: 10000, wantQuota: 500000},
		{name: "half unit", text: strings.Repeat("a", 5000), wantChars: 5000, wantQuota: 250000},
		{
			name:      "han counts twice",
			text:      strings.Repeat("中", 5000),
			wantChars: 10000,
			wantQuota: 500000,
		},
		{
			name:      "mixed han and latin",
			text:      "a中b",
			wantChars: 4,
			wantQuota: 200,
		},
		{
			name:      "kana and hangul count once",
			text:      "アイウ한글",
			wantChars: 5,
			wantQuota: 250,
		},
		{name: "empty input is free", text: "", wantChars: 0, wantQuota: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
			info := perCharsTestInfo(modelName, "default")

			priceData, err := ModelPriceHelper(ctx, info, 0, &types.TokenCountMeta{CombineText: tc.text})
			require.NoError(t, err)
			require.NotNil(t, info.PerCharsBilling)
			assert.Equal(t, tc.wantChars, info.PerCharsBilling.EstimatedChars)
			assert.Equal(t, 1.0, info.PerCharsBilling.PricePer10KChars)
			assert.Equal(t, tc.wantQuota, priceData.QuotaToPreConsume)
			assert.Equal(t, tc.wantQuota, priceData.Quota)
		})
	}
}

func TestModelPriceHelperPerCharsAppliesGroupRatio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = previousQuotaPerUnit })

	saveAndRestorePerCharsConfig(t)

	const modelName = "per-chars-group-model"
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":      `{"per-chars-group-model":"per_chars"}`,
		"billing_setting.per_chars_pricing": `{"per-chars-group-model":{"price_per_10k_chars":1}}`,
		"group_ratio_setting.group_ratio":   `{"vip":2}`,
	}))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)

	priceData, err := ModelPriceHelper(ctx, perCharsTestInfo(modelName, "vip"), 0, &types.TokenCountMeta{CombineText: strings.Repeat("a", 10000)})
	require.NoError(t, err)
	assert.Equal(t, 1000000, priceData.QuotaToPreConsume)
}

func TestModelPriceHelperPerCharsRejectsMissingOrInvalidConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)
	saveAndRestorePerCharsConfig(t)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"per-chars-missing":"per_chars"}`,
	}))
	_, err := ModelPriceHelper(ctx, perCharsTestInfo("per-chars-missing", "default"), 0, &types.TokenCountMeta{CombineText: "hello"})
	require.Error(t, err)

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode":      `{"per-chars-invalid":"per_chars"}`,
		"billing_setting.per_chars_pricing": `{"per-chars-invalid":{"price_per_10k_chars":0}}`,
	}))
	_, err = ModelPriceHelper(ctx, perCharsTestInfo("per-chars-invalid", "default"), 0, &types.TokenCountMeta{CombineText: "hello"})
	require.Error(t, err)
}
