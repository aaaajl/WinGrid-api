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

import { DEFAULT_MIN_PAYOUT_CNY } from '../constants'
import type { FissionReportRow } from '../types'

export function percentToDecimal(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0
  return percent / 100
}

export function decimalToPercent(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 0) return 0
  return decimal * 100
}

export function calculateReward(
  baseCny: number,
  rateDecimal: number,
  minCny = DEFAULT_MIN_PAYOUT_CNY
): { rewardCny: number; skipped: boolean } {
  if (
    baseCny <= 0 ||
    rateDecimal <= 0 ||
    !Number.isFinite(baseCny) ||
    !Number.isFinite(rateDecimal)
  ) {
    return { rewardCny: 0, skipped: true }
  }

  const raw = baseCny * rateDecimal
  const rewardCny = Math.round(raw * 100) / 100
  const min = minCny > 0 ? minCny : DEFAULT_MIN_PAYOUT_CNY

  if (rewardCny < min) {
    return { rewardCny: 0, skipped: true }
  }

  return { rewardCny, skipped: false }
}

export function applyRatePreview(
  rows: FissionReportRow[],
  ratePercent: number,
  minPayoutCny: number
): FissionReportRow[] {
  const rateDecimal = percentToDecimal(ratePercent)
  return rows.map((row) => {
    const { rewardCny, skipped } = calculateReward(
      row.base_cny,
      rateDecimal,
      minPayoutCny
    )
    return {
      ...row,
      rate: rateDecimal,
      reward_cny: rewardCny,
      skipped,
    }
  })
}

export function formatCnyAmount(value: number): string {
  if (!Number.isFinite(value)) return '¥0.00'
  return `¥${value.toFixed(2)}`
}
