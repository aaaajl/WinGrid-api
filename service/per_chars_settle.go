package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/percharsbilling"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

// TryPerCharsSettle settles per-character billing from the upstream-reported
// character count, falling back to the request-derived estimate when the
// upstream omits it. Returns ok=false when the request is not per_chars.
func TryPerCharsSettle(relayInfo *relaycommon.RelayInfo, usage *dto.Usage) (ok bool, quota int, info *relaycommon.PerCharsBillingInfo) {
	if relayInfo == nil || relayInfo.PerCharsBilling == nil {
		return false, 0, nil
	}
	snap := relayInfo.PerCharsBilling

	characters := snap.EstimatedChars
	if usage != nil && usage.Characters > 0 {
		characters = usage.Characters
	}
	characters = min(max(characters, 0), percharsbilling.MaxCharacters)

	costUSD, err := percharsbilling.CostUSD(percharsbilling.Config{PricePer10KChars: snap.PricePer10KChars}, characters)
	if err != nil {
		logger.LogWarn(nil, "per_chars settle: invalid config, falling back to pre-consume: "+err.Error())
		quota = relayInfo.FinalPreConsumedQuota
		if quota <= 0 {
			quota = relayInfo.PriceData.Quota
		}
		return true, quota, snap
	}

	quotaPerUnit := snap.QuotaPerUnit
	if quotaPerUnit <= 0 {
		quotaPerUnit = common.QuotaPerUnit
	}
	quotaAfterGroup, clamp := common.QuotaFromFloatChecked(costUSD * quotaPerUnit * snap.GroupRatio)
	noteQuotaClamp(relayInfo, clamp)

	settled := *snap
	settled.ActualChars = characters
	settled.CostUSD = costUSD
	return true, quotaAfterGroup, &settled
}
