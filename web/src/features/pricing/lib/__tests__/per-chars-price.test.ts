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
import { describe, expect, test } from 'vitest'

import type { PricingModel } from '../../types'
import { isPerCharsModel } from '../model-helpers'
import { formatPerCharsSummaryPrice, getPerCharsPriceUSD } from '../price'

function makeModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'qwen-audio-3.0-tts-flash',
    quota_type: 1,
    model_ratio: 0,
    completion_ratio: 0,
    enable_groups: ['default'],
    billing_mode: 'per_chars',
    per_chars_pricing: { price_per_10k_chars: 0.1 },
    ...overrides,
  }
}

describe('isPerCharsModel', () => {
  test('detects models billed per character', () => {
    expect(isPerCharsModel(makeModel())).toBe(true)
  })

  test('rejects a per_chars mode without pricing config', () => {
    expect(isPerCharsModel(makeModel({ per_chars_pricing: undefined }))).toBe(
      false
    )
  })

  test('rejects other billing modes', () => {
    expect(isPerCharsModel(makeModel({ billing_mode: 'ratio' }))).toBe(false)
  })
})

describe('getPerCharsPriceUSD', () => {
  test('returns the configured price per 10K characters', () => {
    expect(getPerCharsPriceUSD(makeModel())).toBe(0.1)
  })

  test('returns null for non-positive prices', () => {
    expect(
      getPerCharsPriceUSD(
        makeModel({ per_chars_pricing: { price_per_10k_chars: 0 } })
      )
    ).toBeNull()
    expect(getPerCharsPriceUSD(makeModel({ billing_mode: 'ratio' }))).toBeNull()
  })
})

describe('formatPerCharsSummaryPrice', () => {
  test('formats the price per 10K characters', () => {
    expect(formatPerCharsSummaryPrice(makeModel())).toMatch(/0\.1/)
  })

  test('applies the selected group ratio', () => {
    const model = makeModel({
      enable_groups: ['default', 'vip'],
      group_ratio: { vip: 2 },
    })
    expect(formatPerCharsSummaryPrice(model, false, 1, 1, 'vip')).toMatch(/0\.2/)
  })

  test('returns a dash when the model is not per_chars', () => {
    expect(
      formatPerCharsSummaryPrice(makeModel({ billing_mode: 'ratio' }))
    ).toBe('-')
  })
})
