package durationbilling

import (
	"math"
	"testing"
)

func TestNormalizeSizeKey(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"720p", "720P"},
		{"720", "720P"},
		{" 1080P ", "1080P"},
		{"4k", "4K"},
		{"4K", "4K"},
		{"480P", "480P"},
		{"1280x720", "1280X720"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := NormalizeSizeKey(tc.in); got != tc.want {
			t.Fatalf("NormalizeSizeKey(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestCostUSDAcceptanceTable(t *testing.T) {
	// PRD §2 acceptance table (groupRatio=1); QuotaPerUnit applied by caller.
	cfg := Config{
		FallbackPrice: 10,
		SizePrices: map[string]float64{
			"480P":  2,
			"720P":  2,
			"1080P": 5,
			"4K":    10,
		},
	}

	cases := []struct {
		name     string
		size     string
		duration int
		wantBase float64
		wantCost float64
		fallback bool
	}{
		{"480P x 5s", "480P", 5, 2, 10, false},
		{"720P x 5s", "720p", 5, 2, 10, false},
		{"1080P x 5s", "1080", 5, 5, 25, false},
		{"4K x 10s", "4k", 10, 10, 100, false},
		{"unknown size fallback", "1280x720", 5, 10, 50, true},
		{"missing size fallback", "", 5, 10, 50, true},
	}

	const quotaPerUnit = 500_000.0
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			size := NormalizeSizeKey(tc.size)
			cost, base, fb, err := CostUSD(cfg, size, tc.duration)
			if err != nil {
				t.Fatal(err)
			}
			if base != tc.wantBase {
				t.Fatalf("basePrice=%v want %v", base, tc.wantBase)
			}
			if cost != tc.wantCost {
				t.Fatalf("costUSD=%v want %v", cost, tc.wantCost)
			}
			if fb != tc.fallback {
				t.Fatalf("usedFallback=%v want %v", fb, tc.fallback)
			}
			quota := int(cost * quotaPerUnit)
			wantQuota := int(tc.wantCost * quotaPerUnit)
			if quota != wantQuota {
				t.Fatalf("quota=%d want %d", quota, wantQuota)
			}
		})
	}
}

func TestLookupBasePriceNormalizesConfigKeys(t *testing.T) {
	cfg := Config{
		FallbackPrice: 10,
		SizePrices:    map[string]float64{"720p": 2},
	}
	base, fallback := LookupBasePrice(cfg, "720P")
	if fallback || base != 2 {
		t.Fatalf("base=%v fallback=%v", base, fallback)
	}
}

func TestValidate(t *testing.T) {
	if err := Validate(Config{FallbackPrice: 1, SizePrices: map[string]float64{"720P": 2}}); err != nil {
		t.Fatal(err)
	}
	if err := Validate(Config{FallbackPrice: 0}); err == nil {
		t.Fatal("expected error for zero fallback")
	}
	if err := Validate(Config{FallbackPrice: 1, SizePrices: map[string]float64{"720P": math.NaN()}}); err == nil {
		t.Fatal("expected error for NaN size price")
	}
}

func TestCostUSDRejectsNonPositiveDuration(t *testing.T) {
	_, _, _, err := CostUSD(Config{FallbackPrice: 1}, "720P", 0)
	if err == nil {
		t.Fatal("expected error")
	}
}
