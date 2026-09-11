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
import { useTranslation } from 'react-i18next'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDisplayGroupRatio,
  isPeakOffPeakModel,
  isPerCharsModel,
  isPerDurationModel,
} from '../lib/model-helpers'
import {
  formatPeakOffPeakUnitPrice,
  formatPeakOffPeakWindowsSummary,
} from '../lib/peak-offpeak-price'
import {
  formatDurationSummaryPrice,
  formatPerCharsSummaryPrice,
  stripTrailingZeros,
} from '../lib/price'
import type { PricingModel } from '../types'
import { ModelPriceCell, type ModelPriceCellOptions } from './model-price-cell'

// ModelPriceSummaryCell renders a compact price summary for every billing mode,
// falling back to ModelPriceCell for per-token / per-request / tiered_expr.
// Both the catalog price table and the admin model list use it so the two stay
// consistent for per_duration, peak_offpeak, and per_chars models.
export function ModelPriceSummaryCell(props: {
  model: PricingModel
  options?: ModelPriceCellOptions
  showExpression?: boolean
}) {
  const { t } = useTranslation()
  const options = props.options ?? {}
  const {
    tokenUnit = DEFAULT_TOKEN_UNIT,
    priceRate = 1,
    usdExchangeRate = 1,
    showRechargePrice = false,
    selectedGroup,
  } = options

  if (isPeakOffPeakModel(props.model)) {
    const cfg = props.model.peak_offpeak_pricing
    const peakPriceOptions = {
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier: getDisplayGroupRatio(props.model, selectedGroup),
    }
    const inputPrice = stripTrailingZeros(
      formatPeakOffPeakUnitPrice(cfg?.off_peak.cache_miss ?? 0, peakPriceOptions)
    )
    const outputPrice = stripTrailingZeros(
      formatPeakOffPeakUnitPrice(cfg?.off_peak.completion ?? 0, peakPriceOptions)
    )
    return (
      <div className='max-w-full min-w-0'>
        <div className='font-mono text-xs leading-5 tabular-nums'>
          <div>
            {t('From')} {t('Input')} {inputPrice}
          </div>
          <div>
            {t('Output')} {outputPrice}
          </div>
        </div>
        <div className='text-muted-foreground/50 text-[10px]'>
          {formatPeakOffPeakWindowsSummary(props.model, t)}
        </div>
      </div>
    )
  }

  if (isPerDurationModel(props.model)) {
    const price = stripTrailingZeros(
      formatDurationSummaryPrice(
        props.model,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        selectedGroup
      )
    )
    return (
      <div className='max-w-full min-w-0'>
        <span className='font-mono text-sm tabular-nums'>
          {t('From')} {price}
        </span>
        <div className='text-muted-foreground/50 text-[10px]'>
          / {t('sec')}
        </div>
      </div>
    )
  }

  if (isPerCharsModel(props.model)) {
    const price = stripTrailingZeros(
      formatPerCharsSummaryPrice(
        props.model,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        selectedGroup
      )
    )
    return (
      <div className='max-w-full min-w-0'>
        <span className='font-mono text-sm tabular-nums'>{price}</span>
        <div className='text-muted-foreground/50 text-[10px]'>
          / {t('10K chars')}
        </div>
      </div>
    )
  }

  return (
    <ModelPriceCell
      model={props.model}
      options={options}
      showExpression={props.showExpression}
    />
  )
}
