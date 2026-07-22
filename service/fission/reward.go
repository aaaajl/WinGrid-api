package fission

import (
	"math"

	"github.com/shopspring/decimal"
)

type RewardInput struct {
	BaseCNY float64
	Rate    float64
	MinCNY  float64
}

type RewardResult struct {
	RawCNY  float64
	PayCNY  float64
	Skipped bool
}

// CalculateReward computes payout from base CNY and rate. Amounts are rounded to cents.
func CalculateReward(in RewardInput) RewardResult {
	if in.BaseCNY <= 0 || in.Rate <= 0 || math.IsNaN(in.BaseCNY) || math.IsNaN(in.Rate) ||
		math.IsInf(in.BaseCNY, 0) || math.IsInf(in.Rate, 0) {
		return RewardResult{Skipped: true}
	}
	raw := decimal.NewFromFloat(in.BaseCNY).Mul(decimal.NewFromFloat(in.Rate))
	pay := raw.Round(2)
	payF, _ := pay.Float64()
	rawF, _ := raw.Float64()
	minCNY := in.MinCNY
	if minCNY <= 0 {
		minCNY = 10
	}
	if payF < minCNY {
		return RewardResult{RawCNY: rawF, PayCNY: 0, Skipped: true}
	}
	return RewardResult{RawCNY: rawF, PayCNY: payF, Skipped: false}
}

func YuanToCents(yuan float64) int64 {
	return decimal.NewFromFloat(yuan).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

func CentsToYuan(cents int64) float64 {
	f, _ := decimal.NewFromInt(cents).Div(decimal.NewFromInt(100)).Float64()
	return f
}

// QuotaToCNYCents converts quota to CNY fen using snapshots.
func QuotaToCNYCents(eligibleQuota int64, quotaPerUnit, usdExchangeRate float64) int64 {
	if eligibleQuota <= 0 || quotaPerUnit <= 0 || usdExchangeRate <= 0 {
		return 0
	}
	usd := decimal.NewFromInt(eligibleQuota).Div(decimal.NewFromFloat(quotaPerUnit))
	cny := usd.Mul(decimal.NewFromFloat(usdExchangeRate))
	return cny.Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}
