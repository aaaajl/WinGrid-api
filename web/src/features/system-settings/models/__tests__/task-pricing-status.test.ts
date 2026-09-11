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

import {
  hasConfiguredTaskPricing,
  type ModelPricingSnapshot,
} from '../model-pricing-snapshots'

const snapshot = (
  overrides: Partial<ModelPricingSnapshot>
): ModelPricingSnapshot => ({
  name: 'wan3.0-video',
  hasConflict: false,
  ...overrides,
})

describe('hasConfiguredTaskPricing', () => {
  test('treats a per-duration size price table as configured task pricing', () => {
    expect(
      hasConfiguredTaskPricing(
        snapshot({
          billingMode: 'per_duration',
          fallbackPrice: '5',
          sizePrices: [{ size: '1080P', price: '2' }],
        })
      )
    ).toBe(true)
  })

  test('treats a per-duration fallback-only price as configured task pricing', () => {
    expect(
      hasConfiguredTaskPricing(
        snapshot({
          billingMode: 'per_duration',
          fallbackPrice: '5',
          sizePrices: [],
        })
      )
    ).toBe(true)
  })

  test('treats a per-duration model without any positive price as unconfigured', () => {
    expect(
      hasConfiguredTaskPricing(
        snapshot({
          billingMode: 'per_duration',
          fallbackPrice: '',
          sizePrices: [],
        })
      )
    ).toBe(false)
    expect(
      hasConfiguredTaskPricing(
        snapshot({
          billingMode: 'per_duration',
          fallbackPrice: '0',
          sizePrices: [],
        })
      )
    ).toBe(false)
  })

  test('treats expression, per-chars and per-request pricing as configured', () => {
    expect(
      hasConfiguredTaskPricing(
        snapshot({
          billingMode: 'tiered_expr',
          billingExpr: 'tier("a", fixed(1))',
        })
      )
    ).toBe(true)
    expect(
      hasConfiguredTaskPricing(
        snapshot({ billingMode: 'per_chars', perCharsPrice: '0.5' })
      )
    ).toBe(true)
    expect(
      hasConfiguredTaskPricing(
        snapshot({ billingMode: 'per-request', price: '1' })
      )
    ).toBe(true)
  })

  test('treats token pricing and empty expressions as unconfigured', () => {
    expect(
      hasConfiguredTaskPricing(
        snapshot({ billingMode: 'per-token', ratio: '1' })
      )
    ).toBe(false)
    expect(
      hasConfiguredTaskPricing(
        snapshot({ billingMode: 'tiered_expr', billingExpr: '' })
      )
    ).toBe(false)
    expect(hasConfiguredTaskPricing(undefined)).toBe(false)
  })
})
