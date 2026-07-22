package fission

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	ErrFissionDisabled       = errors.New("fission report is disabled")
	ErrFissionCompliance     = errors.New("payment compliance not confirmed")
	ErrFissionPeriodTooEarly = errors.New("period is before start period")
	ErrFissionAsOfInvalid    = errors.New("as_of_date is invalid")
	ErrFissionRefreshBusy    = errors.New("fission refresh already running")
)

type RefreshRequest struct {
	PeriodMonth string
	AsOfDate    string // YYYY-MM-DD, optional
	UserID      int    // optional single invitee
	Manual      bool
}

type RefreshSummary struct {
	PeriodMonth        string   `json:"period_month"`
	AsOfDate           string   `json:"as_of_date"`
	Processed          int      `json:"processed"`
	Succeeded          int      `json:"succeeded"`
	Failed             int      `json:"failed"`
	SkippedZero        int      `json:"skipped_zero"`
	EligibleInvitees   int      `json:"eligible_invitees"`
	TotalEligibleQuota int64    `json:"total_eligible_quota"`
	ErrorSamples       []string `json:"error_samples,omitempty"`
}

type ProgressFunc func(processed, total int)

// ResolveAsOfDate returns the inclusive as-of calendar date in the configured timezone.
// When asOfDate is empty and periodMonth is set, defaults to min(yesterday, last day of that month)
// so historical months can be recalculated without requiring an explicit as_of_date.
func ResolveAsOfDate(periodMonth, asOfDate string, now time.Time) (period string, asOf string, windowStart, windowEnd int64, err error) {
	cfg := operation_setting.GetFissionSetting()
	loc := LoadLocationOrShanghai(cfg.Timezone)
	nowLocal := now.In(loc)

	yesterday := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -1)

	if periodMonth == "" && asOfDate == "" {
		asOfDate = yesterday.Format("2006-01-02")
		periodMonth = yesterday.Format("2006-01")
	}

	if periodMonth != "" {
		if periodMonth < cfg.StartPeriod {
			return "", "", 0, 0, ErrFissionPeriodTooEarly
		}
		monthStart, parseErr := time.ParseInLocation("2006-01-02", periodMonth+"-01", loc)
		if parseErr != nil {
			return "", "", 0, 0, fmt.Errorf("%w: invalid period_month", ErrFissionAsOfInvalid)
		}
		// last calendar day of period month
		monthEnd := monthStart.AddDate(0, 1, -1)
		defaultAsOf := yesterday
		if monthEnd.Before(yesterday) {
			defaultAsOf = monthEnd
		} else if yesterday.Before(monthStart) {
			// period is entirely in the future relative to yesterday — invalid
			return "", "", 0, 0, fmt.Errorf("%w: period_month has no complete day yet", ErrFissionAsOfInvalid)
		}

		if asOfDate == "" {
			asOfDate = defaultAsOf.Format("2006-01-02")
		}
	}

	asOfTime, err := time.ParseInLocation("2006-01-02", asOfDate, loc)
	if err != nil {
		return "", "", 0, 0, ErrFissionAsOfInvalid
	}
	// cannot be after yesterday
	if asOfTime.After(yesterday) {
		return "", "", 0, 0, ErrFissionAsOfInvalid
	}

	if periodMonth == "" {
		periodMonth = asOfTime.Format("2006-01")
	}
	if periodMonth < cfg.StartPeriod {
		return "", "", 0, 0, ErrFissionPeriodTooEarly
	}
	// as_of must fall inside period month
	if asOfTime.Format("2006-01") != periodMonth {
		return "", "", 0, 0, fmt.Errorf("%w: as_of_date not in period_month", ErrFissionAsOfInvalid)
	}

	monthStart, err := time.ParseInLocation("2006-01-02", periodMonth+"-01", loc)
	if err != nil {
		return "", "", 0, 0, err
	}
	windowStart = monthStart.Unix()
	windowEnd = asOfTime.AddDate(0, 0, 1).Unix() // exclusive end of as_of day
	return periodMonth, asOfDate, windowStart, windowEnd, nil
}

func ShouldRunScheduledToday(now time.Time) bool {
	cfg := operation_setting.GetFissionSetting()
	if !cfg.Enabled {
		return false
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return false
	}
	loc := LoadLocationOrShanghai(cfg.Timezone)
	local := now.In(loc)
	// after 00:05
	if local.Hour() == 0 && local.Minute() < 5 {
		return false
	}
	asOf := local.AddDate(0, 0, -1).Format("2006-01-02")
	period := local.AddDate(0, 0, -1).Format("2006-01")
	if period < cfg.StartPeriod {
		return false
	}
	existing, _ := model.GetFissionPeriodAsOfDate(period)
	return existing != asOf
}

// RunRefresh recomputes fission_user_month_stats for the request window.
func RunRefresh(ctx context.Context, req RefreshRequest, progress ProgressFunc) (*RefreshSummary, error) {
	cfg := operation_setting.GetFissionSetting()
	if !cfg.Enabled {
		return nil, ErrFissionDisabled
	}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return nil, ErrFissionCompliance
	}

	period, asOf, windowStart, windowEnd, err := ResolveAsOfDate(req.PeriodMonth, req.AsOfDate, time.Now())
	if err != nil {
		return nil, err
	}

	summary := &RefreshSummary{
		PeriodMonth: period,
		AsOfDate:    asOf,
	}

	replayer := DefaultReplayer()
	quotaPerUnit := common.QuotaPerUnit
	usdRate := operation_setting.USDExchangeRate

	var users []model.User
	if req.UserID > 0 {
		var u model.User
		if err := model.DB.Select("id, username, inviter_id").Where("id = ? AND inviter_id > 0", req.UserID).First(&u).Error; err != nil {
			return nil, err
		}
		users = []model.User{u}
	} else {
		users, err = model.ListInviteeUserIds(0, 0)
		if err != nil {
			return nil, err
		}
	}

	summary.Processed = len(users)
	if progress != nil {
		progress(0, len(users))
	}

	var (
		okCount        int64
		failCount      int64
		zeroCount      int64
		eligibleCount  int64
		eligibleQuota  int64
		mu             sync.Mutex
		samples        []string
		done           int64
	)

	const workers = 8
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup

	reportProgress := func() {
		if progress == nil {
			return
		}
		n := int(atomic.LoadInt64(&done))
		progress(n, len(users))
	}

		gopoolWorker := func(user model.User) {
			defer wg.Done()
			defer func() { <-sem }()
			if ctx.Err() != nil {
				return
			}
			res, replayErr := replayer.ReplayWindow(ctx, user.Id, windowStart, windowEnd)
			if replayErr != nil {
				atomic.AddInt64(&failCount, 1)
				mu.Lock()
				if len(samples) < 10 {
					samples = append(samples, fmt.Sprintf("user %d: %v", user.Id, replayErr))
				}
				mu.Unlock()
			} else {
				cents := QuotaToCNYCents(res.EligibleQuota, quotaPerUnit, usdRate)
				stat := &model.FissionUserMonthStat{
					PeriodMonth:             period,
					UserId:                  user.Id,
					InviterId:               user.InviterId,
					EligibleQuota:           res.EligibleQuota,
					BaseCnyCents:            cents,
					QuotaPerUnitSnapshot:    quotaPerUnit,
					UsdExchangeRateSnapshot: usdRate,
					AsOfDate:                asOf,
					GiftConsumedQuota:       res.GiftConsumedQuota,
					UpdatedAt:               common.GetTimestamp(),
				}
				if upsertErr := model.UpsertFissionUserMonthStat(stat); upsertErr != nil {
					atomic.AddInt64(&failCount, 1)
					mu.Lock()
					if len(samples) < 10 {
						samples = append(samples, fmt.Sprintf("user %d upsert: %v", user.Id, upsertErr))
					}
					mu.Unlock()
				} else {
					atomic.AddInt64(&okCount, 1)
					if res.EligibleQuota == 0 {
						atomic.AddInt64(&zeroCount, 1)
					} else {
						atomic.AddInt64(&eligibleCount, 1)
						atomic.AddInt64(&eligibleQuota, res.EligibleQuota)
					}
				}
			}
			atomic.AddInt64(&done, 1)
			mu.Lock()
			reportProgress()
			mu.Unlock()
		}

		for _, u := range users {
			if ctx.Err() != nil {
				break
			}
			user := u
			wg.Add(1)
			sem <- struct{}{}
			go gopoolWorker(user)
		}
	wg.Wait()
	if progress != nil {
		progress(len(users), len(users))
	}
	summary.Succeeded = int(okCount)
	summary.Failed = int(failCount)
	summary.SkippedZero = int(zeroCount)
	summary.EligibleInvitees = int(eligibleCount)
	summary.TotalEligibleQuota = eligibleQuota
	summary.ErrorSamples = samples
	return summary, nil
}
