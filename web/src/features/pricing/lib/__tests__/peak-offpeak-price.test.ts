/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../../types'
import {
  formatPeakOffPeakSummaryPrice,
  formatPeakOffPeakWindowsSummary,
  getPeakOffPeakSortPrice,
} from '../peak-offpeak-price'

function makeModel(
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: 1,
    model_name: 'deepseek-v4-flash',
    quota_type: 0,
    model_ratio: 0,
    completion_ratio: 0,
    enable_groups: ['default'],
    billing_mode: 'peak_offpeak',
    peak_offpeak_pricing: {
      timezone: 'Asia/Shanghai',
      weekdays_only: true,
      peak_windows: ['09:00-12:00', '14:00-18:00'],
      peak: { cache_hit: 0.014, cache_miss: 0.44, completion: 1.32 },
      off_peak: { cache_hit: 0.007, cache_miss: 0.22, completion: 0.66 },
    },
    ...overrides,
  }
}

describe('formatPeakOffPeakSummaryPrice', () => {
  test('returns off-peak in/out summary for USD display', () => {
    const summary = formatPeakOffPeakSummaryPrice(makeModel(), {
      tokenUnit: 'M',
      showRechargePrice: false,
      priceRate: 1,
      usdExchangeRate: 1,
      groupRatioMultiplier: 1,
    })
    assert.match(summary, /^in /)
    assert.match(summary, /0\.22/)
    assert.match(summary, /0\.66/)
    assert.doesNotMatch(summary, /Peak/)
    assert.doesNotMatch(summary, /0\.44/)
  })

  test('returns dash when peak_offpeak config is missing', () => {
    const summary = formatPeakOffPeakSummaryPrice(
      makeModel({ billing_mode: 'peak_offpeak', peak_offpeak_pricing: undefined })
    )
    assert.equal(summary, '-')
  })
})

describe('formatPeakOffPeakWindowsSummary', () => {
  test('includes windows, timezone, and weekdays-only note', () => {
    const text = formatPeakOffPeakWindowsSummary(makeModel(), (key) => key)
    assert.match(text, /09:00-12:00/)
    assert.match(text, /14:00-18:00/)
    assert.match(text, /Asia\/Shanghai/)
    assert.match(text, /Weekdays only/)
  })
})

describe('getPeakOffPeakSortPrice', () => {
  test('uses off-peak input price', () => {
    assert.equal(getPeakOffPeakSortPrice(makeModel()), 0.22)
  })
})
