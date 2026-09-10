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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import { TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { getDisplayGroupRatio, isPeakOffPeakModel } from './model-helpers'

export type PeakOffPeakPriceOptions = {
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatioMultiplier?: number
  selectedGroup?: string
}

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function formatPeakOffPeakUnitPrice(
  valuePerMillionTokens: number,
  options: PeakOffPeakPriceOptions = {}
): string {
  const tokenUnit = options.tokenUnit ?? 'M'
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD =
    (valuePerMillionTokens * groupRatio) / TOKEN_UNIT_DIVISORS[tokenUnit]
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * List/card summary: off-peak input / output only.
 * Callers should prefix with t('From') (「起」).
 * Example: in $0.22 / out $0.66
 */
export function formatPeakOffPeakSummaryPrice(
  model: PricingModel,
  options: PeakOffPeakPriceOptions = {}
): string {
  if (!isPeakOffPeakModel(model) || !model.peak_offpeak_pricing) {
    return '-'
  }

  const cfg = model.peak_offpeak_pricing
  const groupRatio =
    options.groupRatioMultiplier ??
    getDisplayGroupRatio(model, options.selectedGroup)
  const priceOptions = {
    ...options,
    groupRatioMultiplier: groupRatio,
  }

  const offIn = formatPeakOffPeakUnitPrice(
    cfg.off_peak.cache_miss,
    priceOptions
  )
  const offOut = formatPeakOffPeakUnitPrice(
    cfg.off_peak.completion,
    priceOptions
  )

  return `in ${offIn} / out ${offOut}`
}

export function formatPeakOffPeakWindowsSummary(
  model: PricingModel,
  t: (key: string) => string
): string {
  if (!isPeakOffPeakModel(model) || !model.peak_offpeak_pricing) {
    return ''
  }

  const cfg = model.peak_offpeak_pricing
  const windows = (cfg.peak_windows || []).join(', ')
  const timezone = cfg.timezone || 'Asia/Shanghai'
  const weekdayNote = cfg.weekdays_only ? ` · ${t('Weekdays only')}` : ''
  if (!windows) {
    return `${timezone}${weekdayNote}`
  }
  return `${windows} (${timezone})${weekdayNote}`
}

export function getPeakOffPeakSortPrice(model: PricingModel): number {
  if (!isPeakOffPeakModel(model) || !model.peak_offpeak_pricing) {
    return Number.POSITIVE_INFINITY
  }
  const off = model.peak_offpeak_pricing.off_peak.cache_miss
  if (!Number.isFinite(off)) return Number.POSITIVE_INFINITY
  return off
}
