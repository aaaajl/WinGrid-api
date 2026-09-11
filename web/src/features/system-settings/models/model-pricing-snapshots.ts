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
import { splitBillingExprAndRequestRules } from '@/features/pricing/lib/billing-expr'

import { safeJsonParse } from '../utils/json-parser'
import {
  peakOffPeakConfigToForm,
  type PeakOffPeakConfig,
  type PeakOffPeakFormValues,
} from './model-pricing-core'
import { formatPricingNumber } from './pricing-format'

export type ModelPricingSnapshotInput = {
  modelPrice: string
  modelRatio: string
  cacheRatio: string
  createCacheRatio: string
  completionRatio: string
  imageRatio: string
  audioRatio: string
  audioCompletionRatio: string
  billingMode: string
  billingExpr: string
  durationPricing?: string
  peakOffPeakPricing?: string
  perCharsPricing?: string
}

export type DurationPricingConfig = {
  fallback_price?: number
  size_prices?: Record<string, number>
}

export type PerCharsPricingConfig = {
  price_per_10k_chars?: number
}

export type { PeakOffPeakConfig }

export type ModelPricingSnapshot = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: string
  billingExpr?: string
  requestRuleExpr?: string
  fallbackPrice?: string
  sizePrices?: { size: string; price: string }[]
  peakOffPeak?: PeakOffPeakFormValues
  perCharsPrice?: string
  hasConflict: boolean
}

export type ModelRow = ModelPricingSnapshot & {
  saved?: ModelPricingSnapshot
  draft?: ModelPricingSnapshot
  isDraftChanged: boolean
  isDraftDeleted: boolean
  isDraftNew: boolean
}

export const hasPricingValue = (value?: string) =>
  value !== undefined && value !== ''

export const isBasePricingUnset = (snapshot?: ModelPricingSnapshot) =>
  !snapshot ||
  (snapshot.billingMode !== 'tiered_expr' &&
    snapshot.billingMode !== 'per_duration' &&
    snapshot.billingMode !== 'peak_offpeak' &&
    snapshot.billingMode !== 'per_chars' &&
    !hasPricingValue(snapshot.price) &&
    !hasPricingValue(snapshot.ratio))

const toNumberOrNull = (value?: string) => {
  if (!hasPricingValue(value)) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const ratioToPrice = (ratio?: string, denominator?: string) => {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = denominator ? toNumberOrNull(denominator) : 2
  if (ratioNumber === null || denominatorNumber === null) return ''
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

const hasPositivePricingValue = (value?: string) => {
  const num = toNumberOrNull(value)
  return num !== null && num > 0
}

// Configured task pricing means the model carries a usable definite-charge
// mode: expression, per-duration, per-chars, or a fixed per-request price.
// Token pricing and peak/off-peak leave task models without a task-ready charge.
export const hasConfiguredTaskPricing = (snapshot?: ModelPricingSnapshot) => {
  if (!snapshot) return false
  if (snapshot.billingMode === 'tiered_expr') {
    return hasPricingValue(snapshot.billingExpr)
  }
  if (snapshot.billingMode === 'per_duration') {
    const hasSizePrice =
      snapshot.sizePrices?.some((sizePrice) =>
        hasPositivePricingValue(sizePrice.price)
      ) ?? false
    return hasPositivePricingValue(snapshot.fallbackPrice) || hasSizePrice
  }
  if (snapshot.billingMode === 'per_chars') {
    return hasPositivePricingValue(snapshot.perCharsPrice)
  }
  if (snapshot.billingMode === 'per-request') {
    return hasPricingValue(snapshot.price)
  }
  return false
}

export const getModeLabel = (mode?: string) => {
  if (mode === 'per-request') return 'Per-request'
  if (mode === 'tiered_expr') return 'Expression'
  if (mode === 'per_duration') return 'Per-duration'
  if (mode === 'peak_offpeak') return 'Peak / Off-peak'
  if (mode === 'per_chars') return 'Per-chars'
  return 'Per-token'
}

export const getModeVariant = (
  mode?: string
): 'warning' | 'info' | 'success' | 'neutral' => {
  if (mode === 'per-request') return 'warning'
  if (mode === 'tiered_expr') return 'info'
  if (mode === 'per_duration') return 'neutral'
  if (mode === 'per_chars') return 'neutral'
  if (mode === 'peak_offpeak') return 'warning'
  return 'success'
}

const getExpressionSummary = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  const tierCount = (row.billingExpr?.match(/tier\(/g) || []).length
  if (tierCount > 0) {
    return `${t('Tiered pricing')} · ${tierCount} ${t('tiers')}`
  }
  return t('Expression pricing')
}

export const getPriceSummary = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  if (row.billingMode === 'tiered_expr') {
    return getExpressionSummary(row, t)
  }
  if (row.billingMode === 'per_duration') {
    const count = row.sizePrices?.length || 0
    return count > 0
      ? `${t('Per-duration')} · ${count} ${t('sizes')}`
      : t('Per-duration')
  }
  if (row.billingMode === 'per_chars') {
    return row.perCharsPrice
      ? `${t('Per 10K Characters')} $${row.perCharsPrice}`
      : t('Unset price')
  }
  if (row.billingMode === 'peak_offpeak') {
    const peakIn = row.peakOffPeak?.peak.cacheMiss
    const peakOut = row.peakOffPeak?.peak.completion
    if (peakIn && peakOut) {
      return `${t('Peak')} $${peakIn} / $${peakOut}`
    }
    return t('Peak / Off-peak')
  }
  if (row.billingMode === 'per-request') {
    return row.price ? `$${row.price} / ${t('request')}` : t('Unset price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('Unset price')

  return `${t('Input')} $${inputPrice}`
}

export const getPriceDetail = (
  row: ModelPricingSnapshot,
  t: (key: string) => string
) => {
  if (row.billingMode === 'tiered_expr') {
    return row.requestRuleExpr
      ? t('Includes request rules')
      : t('Expression based')
  }
  if (row.billingMode === 'per_duration') {
    return row.fallbackPrice
      ? `${t('Fallback')} $${row.fallbackPrice}/s`
      : t('Size × duration pricing')
  }
  if (row.billingMode === 'per_chars') {
    return t('Priced per 10,000 characters')
  }
  if (row.billingMode === 'peak_offpeak') {
    const windows = row.peakOffPeak?.peakWindows
      ?.filter((w) => w.start && w.end)
      .map((w) => `${w.start}-${w.end}`)
    if (windows && windows.length > 0) {
      return `${t('Peak hours')}: ${windows.join(', ')}`
    }
    return t('Peak / Off-peak pricing')
  }
  if (row.billingMode === 'per-request') {
    return t('Fixed request price')
  }

  const inputPrice = ratioToPrice(row.ratio)
  if (!inputPrice) return t('No base input price')

  const details = [
    row.completionRatio &&
      `${t('Output')} $${ratioToPrice(row.completionRatio, inputPrice)}`,
    row.cacheRatio &&
      `${t('Cache')} $${ratioToPrice(row.cacheRatio, inputPrice)}`,
    row.createCacheRatio &&
      `${t('Cache write')} $${ratioToPrice(row.createCacheRatio, inputPrice)}`,
  ]
    .filter(Boolean)
    .slice(0, 2)

  return details.length > 0 ? details.join(' · ') : t('Base input price only')
}

export const buildModelSnapshots = ({
  modelPrice,
  modelRatio,
  cacheRatio,
  createCacheRatio,
  completionRatio,
  imageRatio,
  audioRatio,
  audioCompletionRatio,
  billingMode,
  billingExpr,
  durationPricing = '{}',
  peakOffPeakPricing = '{}',
  perCharsPricing = '{}',
}: ModelPricingSnapshotInput): ModelPricingSnapshot[] => {
  const priceMap = safeJsonParse<Record<string, number>>(modelPrice, {
    fallback: {},
    context: 'model prices',
  })
  const ratioMap = safeJsonParse<Record<string, number>>(modelRatio, {
    fallback: {},
    context: 'model ratios',
  })
  const cacheMap = safeJsonParse<Record<string, number>>(cacheRatio, {
    fallback: {},
    context: 'cache ratios',
  })
  const createCacheMap = safeJsonParse<Record<string, number>>(
    createCacheRatio,
    { fallback: {}, context: 'create cache ratios' }
  )
  const completionMap = safeJsonParse<Record<string, number>>(completionRatio, {
    fallback: {},
    context: 'completion ratios',
  })
  const imageMap = safeJsonParse<Record<string, number>>(imageRatio, {
    fallback: {},
    context: 'image ratios',
  })
  const audioMap = safeJsonParse<Record<string, number>>(audioRatio, {
    fallback: {},
    context: 'audio ratios',
  })
  const audioCompletionMap = safeJsonParse<Record<string, number>>(
    audioCompletionRatio,
    { fallback: {}, context: 'audio completion ratios' }
  )
  const billingModeMap = safeJsonParse<Record<string, string>>(billingMode, {
    fallback: {},
    context: 'billing mode',
  })
  const billingExprMap = safeJsonParse<Record<string, string>>(billingExpr, {
    fallback: {},
    context: 'billing expression',
  })
  const durationPricingMap = safeJsonParse<
    Record<string, DurationPricingConfig>
  >(durationPricing, {
    fallback: {},
    context: 'duration pricing',
  })
  const peakOffPeakPricingMap = safeJsonParse<
    Record<string, PeakOffPeakConfig>
  >(peakOffPeakPricing, {
    fallback: {},
    context: 'peak offpeak pricing',
  })
  const perCharsPricingMap = safeJsonParse<
    Record<string, PerCharsPricingConfig>
  >(perCharsPricing, {
    fallback: {},
    context: 'per chars pricing',
  })

  const modelNames = new Set([
    ...Object.keys(priceMap),
    ...Object.keys(ratioMap),
    ...Object.keys(cacheMap),
    ...Object.keys(createCacheMap),
    ...Object.keys(completionMap),
    ...Object.keys(imageMap),
    ...Object.keys(audioMap),
    ...Object.keys(audioCompletionMap),
    ...Object.keys(billingModeMap),
    ...Object.keys(billingExprMap),
    ...Object.keys(durationPricingMap),
    ...Object.keys(peakOffPeakPricingMap),
    ...Object.keys(perCharsPricingMap),
  ])

  return [...modelNames].map((name) => {
    const price = priceMap[name]?.toString() || ''
    const ratio = ratioMap[name]?.toString() || ''
    const cache = cacheMap[name]?.toString() || ''
    const createCache = createCacheMap[name]?.toString() || ''
    const completion = completionMap[name]?.toString() || ''
    const image = imageMap[name]?.toString() || ''
    const audio = audioMap[name]?.toString() || ''
    const audioCompletion = audioCompletionMap[name]?.toString() || ''

    const modeForModel = billingModeMap[name]
    if (modeForModel === 'tiered_expr') {
      const fullExpr = billingExprMap[name] || ''
      const { billingExpr: pureExpr, requestRuleExpr } =
        splitBillingExprAndRequestRules(fullExpr)
      return {
        name,
        billingMode: 'tiered_expr',
        billingExpr: pureExpr,
        requestRuleExpr,
        price,
        ratio,
        cacheRatio: cache,
        createCacheRatio: createCache,
        completionRatio: completion,
        imageRatio: image,
        audioRatio: audio,
        audioCompletionRatio: audioCompletion,
        hasConflict: false,
      }
    }

    if (modeForModel === 'per_duration') {
      const cfg = durationPricingMap[name] || {}
      const sizePrices = Object.entries(cfg.size_prices || {}).map(
        ([size, sizePrice]) => ({
          size,
          price: String(sizePrice),
        })
      )
      return {
        name,
        billingMode: 'per_duration',
        fallbackPrice:
          cfg.fallback_price !== undefined ? String(cfg.fallback_price) : '',
        sizePrices,
        price,
        ratio,
        cacheRatio: cache,
        createCacheRatio: createCache,
        completionRatio: completion,
        imageRatio: image,
        audioRatio: audio,
        audioCompletionRatio: audioCompletion,
        hasConflict: false,
      }
    }

    if (modeForModel === 'per_chars') {
      const cfg = perCharsPricingMap[name] || {}
      return {
        name,
        billingMode: 'per_chars',
        perCharsPrice:
          cfg.price_per_10k_chars !== undefined
            ? String(cfg.price_per_10k_chars)
            : '',
        price,
        ratio,
        cacheRatio: cache,
        createCacheRatio: createCache,
        completionRatio: completion,
        imageRatio: image,
        audioRatio: audio,
        audioCompletionRatio: audioCompletion,
        hasConflict: false,
      }
    }

    if (modeForModel === 'peak_offpeak') {
      return {
        name,
        billingMode: 'peak_offpeak',
        peakOffPeak: peakOffPeakConfigToForm(peakOffPeakPricingMap[name]),
        price,
        ratio,
        cacheRatio: cache,
        createCacheRatio: createCache,
        completionRatio: completion,
        imageRatio: image,
        audioRatio: audio,
        audioCompletionRatio: audioCompletion,
        hasConflict: false,
      }
    }

    return {
      name,
      price,
      ratio,
      cacheRatio: cache,
      createCacheRatio: createCache,
      completionRatio: completion,
      imageRatio: image,
      audioRatio: audio,
      audioCompletionRatio: audioCompletion,
      billingMode: price !== '' ? 'per-request' : 'per-token',
      hasConflict:
        price !== '' &&
        (ratio !== '' ||
          completion !== '' ||
          cache !== '' ||
          createCache !== '' ||
          image !== '' ||
          audio !== '' ||
          audioCompletion !== ''),
    }
  })
}

export const getSnapshotSignature = (snapshot?: ModelPricingSnapshot) => {
  if (!snapshot) return ''
  return JSON.stringify({
    price: snapshot.price || '',
    ratio: snapshot.ratio || '',
    cacheRatio: snapshot.cacheRatio || '',
    createCacheRatio: snapshot.createCacheRatio || '',
    completionRatio: snapshot.completionRatio || '',
    imageRatio: snapshot.imageRatio || '',
    audioRatio: snapshot.audioRatio || '',
    audioCompletionRatio: snapshot.audioCompletionRatio || '',
    billingMode: snapshot.billingMode || 'per-token',
    billingExpr: snapshot.billingExpr || '',
    requestRuleExpr: snapshot.requestRuleExpr || '',
    fallbackPrice: snapshot.fallbackPrice || '',
    sizePrices: snapshot.sizePrices || [],
    peakOffPeak: snapshot.peakOffPeak || undefined,
    perCharsPrice: snapshot.perCharsPrice || '',
  })
}
