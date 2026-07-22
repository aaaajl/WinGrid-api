package fission

import (
	"context"
	"encoding/json"
	"sort"
)

type CreditKind int

const (
	CreditKindGift CreditKind = iota
	CreditKindPaid
)

type CreditEvent struct {
	UserID     int
	Quota      int64
	OccurredAt int64
	Source     string
	Kind       CreditKind
}

type CreditClassifier interface {
	Name() string
	ListCredits(ctx context.Context, userID int, fromTs, toTs int64) ([]CreditEvent, error)
}

type ConsumeEvent struct {
	UserID         int
	Quota          int64
	OccurredAt     int64
	BillingSource  string
	RawOther       json.RawMessage
}

type ConsumeFilter interface {
	Name() string
	Allow(ev ConsumeEvent) bool
}

type ConsumeLoader interface {
	ListConsumes(ctx context.Context, userID int, fromTs, toTs int64) ([]ConsumeEvent, error)
}

type ledgerEventKind int

const (
	ledgerCredit ledgerEventKind = iota
	ledgerConsume
)

type ledgerEvent struct {
	At   int64
	Kind ledgerEventKind
	Credit CreditEvent
	Consume ConsumeEvent
}

// ReplayResult is the outcome of gift-first ledger replay.
type ReplayResult struct {
	EligibleQuota     int64
	GiftConsumedQuota int64
	GiftBalance       int64
	PaidBalance       int64
}

// LedgerReplayer replays credits and consumes with gift-first burn order.
type LedgerReplayer struct {
	Credits  []CreditClassifier
	Filters  []ConsumeFilter
	Consumes ConsumeLoader
}

// ReplayWindow replays all events from the beginning of history up to toTs (exclusive end),
// and returns eligible paid consumption that falls inside [windowStart, windowEnd).
func (r *LedgerReplayer) ReplayWindow(ctx context.Context, userID int, windowStart, windowEnd int64) (*ReplayResult, error) {
	if windowEnd <= 0 {
		return &ReplayResult{}, nil
	}
	credits := make([]CreditEvent, 0)
	for _, c := range r.Credits {
		evs, err := c.ListCredits(ctx, userID, 0, windowEnd)
		if err != nil {
			return nil, err
		}
		credits = append(credits, evs...)
	}

	consumes, err := r.Consumes.ListConsumes(ctx, userID, 0, windowEnd)
	if err != nil {
		return nil, err
	}

	events := make([]ledgerEvent, 0, len(credits)+len(consumes))
	for _, c := range credits {
		if c.Quota <= 0 {
			continue
		}
		events = append(events, ledgerEvent{At: c.OccurredAt, Kind: ledgerCredit, Credit: c})
	}
	for _, c := range consumes {
		if c.Quota <= 0 {
			continue
		}
		if !r.allowConsume(c) {
			continue
		}
		events = append(events, ledgerEvent{At: c.OccurredAt, Kind: ledgerConsume, Consume: c})
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].At == events[j].At {
			// credits before consumes on same timestamp keeps balances safer
			return events[i].Kind < events[j].Kind
		}
		return events[i].At < events[j].At
	})

	var giftBal, paidBal int64
	var eligible, giftConsumed int64
	for _, ev := range events {
		switch ev.Kind {
		case ledgerCredit:
			if ev.Credit.Kind == CreditKindPaid {
				paidBal += ev.Credit.Quota
			} else {
				giftBal += ev.Credit.Quota
			}
		case ledgerConsume:
			q := ev.Consume.Quota
			fromGift := int64(0)
			if giftBal > 0 {
				if giftBal >= q {
					fromGift = q
					giftBal -= q
					q = 0
				} else {
					fromGift = giftBal
					q -= giftBal
					giftBal = 0
				}
			}
			// Remainder after known gifts is commissionable. Known paid balance
			// is decremented for bookkeeping; any uncovered remainder (missing
			// topup records / pre-ledger balance) still counts as eligible so
			// incomplete credit classification does not zero the report.
			commissionable := q
			fromPaid := commissionable
			if fromPaid > paidBal {
				fromPaid = paidBal
			}
			paidBal -= fromPaid

			inWindow := ev.At >= windowStart && ev.At < windowEnd
			if inWindow {
				eligible += commissionable
				giftConsumed += fromGift
			}
		}
	}

	return &ReplayResult{
		EligibleQuota:     eligible,
		GiftConsumedQuota: giftConsumed,
		GiftBalance:       giftBal,
		PaidBalance:       paidBal,
	}, nil
}

func (r *LedgerReplayer) allowConsume(ev ConsumeEvent) bool {
	for _, f := range r.Filters {
		if !f.Allow(ev) {
			return false
		}
	}
	return true
}
