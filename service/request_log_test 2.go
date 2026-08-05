package service

import (
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
)

func TestResolveRequestLogBody(t *testing.T) {
	body := []byte(`{"model":"gpt-4o"}`)

	t.Run("within limit stores body", func(t *testing.T) {
		got, omitted := resolveRequestLogBody(body, len(body), 1024)
		if omitted || got != string(body) {
			t.Fatalf("expected body stored, got omitted=%v body=%q", omitted, got)
		}
	})

	t.Run("over limit omits body", func(t *testing.T) {
		got, omitted := resolveRequestLogBody(body, 2048, 1)
		if !omitted || got != "" {
			t.Fatalf("expected omitted body, got omitted=%v body=%q", omitted, got)
		}
	})

	t.Run("max zero always omits", func(t *testing.T) {
		got, omitted := resolveRequestLogBody(body, len(body), 0)
		if !omitted || got != "" {
			t.Fatalf("expected omitted body, got omitted=%v body=%q", omitted, got)
		}
	})
}

func TestShouldRedactHeader(t *testing.T) {
	names := parseRedactHeaderNames("Authorization,Cookie")
	if !shouldRedactHeader("Authorization", names) {
		t.Fatal("expected Authorization to be redacted")
	}
	if shouldRedactHeader("Content-Type", names) {
		t.Fatal("did not expect Content-Type to be redacted")
	}
	if !shouldRedactHeader("X-Custom-Key", names) {
		t.Fatal("expected suffix -key header to be redacted")
	}
}

func TestShouldRecordMidjourneyRequestLog(t *testing.T) {
	if ShouldRecordMidjourneyRequestLog(relayconstant.RelayModeMidjourneyTaskFetch) {
		t.Fatal("task fetch should not be recorded")
	}
	if !ShouldRecordMidjourneyRequestLog(relayconstant.RelayModeMidjourneyImagine) {
		t.Fatal("imagine submit should be recorded")
	}
}
