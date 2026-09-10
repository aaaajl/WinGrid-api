package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/peakoffpeak"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

// BuildPeakOffPeakTokenParams normalizes usage for peak/off-peak pricing.
// MVP always prices cache hit (cr) separately, so non-Claude totals subtract
// cached tokens from p (same semantics as tiered expr with cr in the expression).
func BuildPeakOffPeakTokenParams(usage *dto.Usage, isClaudeUsageSemantic bool) peakoffpeak.TokenParams {
	if usage == nil {
		return peakoffpeak.TokenParams{}
	}
	p := float64(usage.PromptTokens)
	c := float64(usage.CompletionTokens)
	cr := float64(usage.PromptTokensDetails.CachedTokens)
	cc := float64(usage.PromptTokensDetails.CacheCreationTokensTotal())
	if usage.UsageSemantic == "anthropic" {
		cc = float64(usage.ClaudeCacheCreation5mTokens + usage.ClaudeCacheCreation1hTokens)
	}
	img := float64(usage.PromptTokensDetails.ImageTokens)
	ai := float64(usage.PromptTokensDetails.AudioTokens)
	ao := float64(usage.CompletionTokenDetails.AudioTokens)

	if !isClaudeUsageSemantic {
		p -= cr
		// Optional sub-categories stay in p/c unless separately priced later.
		if p < 0 {
			p = 0
		}
	}
	if c < 0 {
		c = 0
	}
	return peakoffpeak.TokenParams{
		P:   p,
		CR:  cr,
		C:   c,
		CC:  cc,
		Img: img,
		AI:  ai,
		AO:  ao,
	}
}

// TryPeakOffPeakSettle settles peak/off-peak billing using the frozen EvalUnix.
// Returns ok=false when the request is not peak_offpeak.
func TryPeakOffPeakSettle(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, isClaudeUsageSemantic bool) (ok bool, quota int, result *peakoffpeak.Result) {
	if relayInfo == nil {
		return false, 0, nil
	}
	snap := relayInfo.PeakOffPeakSnapshot
	if snap == nil || snap.BillingMode != billing_setting.BillingModePeakOffPeak {
		return false, 0, nil
	}

	cfg := snap.Config
	if err := peakoffpeak.Validate(cfg); err != nil {
		logger.LogWarn(nil, "peak_offpeak settle: invalid snapshot config, falling back to pre-consume: "+err.Error())
		quota = relayInfo.FinalPreConsumedQuota
		if quota <= 0 {
			quota = snap.EstimatedQuotaAfterGroup
		}
		return true, quota, nil
	}

	evalAt := time.Unix(snap.EvalUnix, 0).UTC()
	if snap.EvalUnix == 0 {
		logger.LogWarn(nil, "peak_offpeak settle: EvalUnix is 0, falling back to wall clock")
		evalAt = time.Now()
	}

	period, err := peakoffpeak.ResolvePeriod(cfg, evalAt)
	if err != nil {
		logger.LogWarn(nil, "peak_offpeak settle: resolve period failed: "+err.Error())
		quota = relayInfo.FinalPreConsumedQuota
		if quota <= 0 {
			quota = snap.EstimatedQuotaAfterGroup
		}
		return true, quota, nil
	}

	tokens := BuildPeakOffPeakTokenParams(usage, isClaudeUsageSemantic)
	costUSD := peakoffpeak.CalcCostUSD(peakoffpeak.PricesForPeriod(cfg, period), tokens)
	quotaPerUnit := snap.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	groupRatio := snap.GroupRatio

	quotaBeforeGroup := costUSD * quotaPerUnit
	quotaAfterGroup, clamp := common.QuotaFromFloatChecked(quotaBeforeGroup * groupRatio)
	noteQuotaClamp(relayInfo, clamp)

	res := &peakoffpeak.Result{
		ActualQuotaBeforeGroup: quotaBeforeGroup,
		ActualQuotaAfterGroup:  quotaAfterGroup,
		MatchedPeriod:          period,
		CostUSD:                costUSD,
	}
	return true, quotaAfterGroup, res
}
