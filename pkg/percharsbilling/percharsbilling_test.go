package percharsbilling

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCostUSDProratesPerTenThousandChars(t *testing.T) {
	cfg := Config{PricePer10KChars: 2}

	cases := []struct {
		name       string
		characters int
		wantUSD    float64
	}{
		{name: "empty is free", characters: 0, wantUSD: 0},
		{name: "one full unit", characters: 10000, wantUSD: 2},
		{name: "half unit", characters: 5000, wantUSD: 1},
		{name: "multiple units", characters: 25000, wantUSD: 5},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cost, err := CostUSD(cfg, tc.characters)
			require.NoError(t, err)
			assert.InDelta(t, tc.wantUSD, cost, 1e-9)
		})
	}
}

func TestCostUSDClampsOversizedCharacterCount(t *testing.T) {
	cfg := Config{PricePer10KChars: 1}

	cost, err := CostUSD(cfg, MaxCharacters+1_000_000)
	require.NoError(t, err)

	maxCost, err := CostUSD(cfg, MaxCharacters)
	require.NoError(t, err)
	assert.Equal(t, maxCost, cost)
}

func TestCostUSDRejectsNegativeCharacters(t *testing.T) {
	_, err := CostUSD(Config{PricePer10KChars: 1}, -1)
	require.Error(t, err)
}

func TestEstimatedCharactersWeightsHanIdeographsTwice(t *testing.T) {
	cases := []struct {
		name string
		text string
		want int
	}{
		{name: "empty", text: "", want: 0},
		{name: "latin counts once", text: "abc", want: 3},
		{name: "han counts twice", text: "中中中", want: 6},
		{name: "mixed latin and han", text: "a中b", want: 4},
		{name: "han extension counts twice", text: "㐀", want: 2},
		{name: "ideographic zero counts twice", text: "〇", want: 2},
		{name: "kana counts once", text: "アイウ", want: 3},
		{name: "hangul counts once", text: "한글", want: 2},
		{name: "fullwidth digits count once", text: "１２", want: 2},
		{name: "accented latin counts once", text: "é", want: 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, EstimatedCharacters(tc.text))
		})
	}
}

func TestValidateRejectsNonPositiveAndNonFinitePrices(t *testing.T) {
	require.NoError(t, Validate(Config{PricePer10KChars: 0.1}))

	for _, price := range []float64{0, -1, math.NaN(), math.Inf(1), math.Inf(-1)} {
		require.Error(t, Validate(Config{PricePer10KChars: price}), "price %v must be rejected", price)
	}
}
