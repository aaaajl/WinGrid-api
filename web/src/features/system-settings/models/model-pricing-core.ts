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
import * as z from 'zod'

import {
  formatPricingAmount,
  USD_PRICING_CURRENCY,
  type PricingCurrency,
} from '@/features/model-pricing/currency'
import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'

import { formatPricingNumber } from './pricing-format'

export const createModelPricingSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
    ratio: z.string().optional(),
    cacheRatio: z.string().optional(),
    createCacheRatio: z.string().optional(),
    completionRatio: z.string().optional(),
    imageRatio: z.string().optional(),
    audioRatio: z.string().optional(),
    audioCompletionRatio: z.string().optional(),
  })

export type ModelPricingFormValues = z.infer<
  ReturnType<typeof createModelPricingSchema>
>

export type PricingMode =
  | 'per-token'
  | 'per-request'
  | 'tiered_expr'
  | 'per_duration'
  | 'peak_offpeak'
  | 'per_chars'

export type DurationSizePriceRow = {
  size: string
  price: string
}

export const DEFAULT_DURATION_FALLBACK_PRICE = '10'
export const DEFAULT_PER_CHARS_PRICE = '0.1'
export const DEFAULT_DURATION_SIZE_PRICES: DurationSizePriceRow[] = [
  { size: '480P', price: '1' },
  { size: '720P', price: '1' },
  { size: '1080P', price: '2' },
  { size: '4K', price: '10' },
]

export type PeakOffPeakTokenPriceForm = {
  cacheHit: string
  cacheMiss: string
  completion: string
}

export type PeakOffPeakWindowForm = {
  start: string
  end: string
}

export type PeakOffPeakFormValues = {
  timezone: string
  weekdaysOnly: boolean
  peakWindows: PeakOffPeakWindowForm[]
  peak: PeakOffPeakTokenPriceForm
  offPeak: PeakOffPeakTokenPriceForm
}

export type PeakOffPeakConfig = {
  timezone: string
  weekdays_only: boolean
  peak_windows: Array<{ start: string; end: string }>
  peak: {
    cache_hit: number
    cache_miss: number
    completion: number
  }
  off_peak: {
    cache_hit: number
    cache_miss: number
    completion: number
  }
}

export const DEFAULT_PEAK_OFFPEAK_TIMEZONE = 'Asia/Shanghai'

export const DEFAULT_PEAK_WINDOWS: PeakOffPeakWindowForm[] = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
]

export const DEFAULT_PEAK_OFFPEAK_FORM: PeakOffPeakFormValues = {
  timezone: DEFAULT_PEAK_OFFPEAK_TIMEZONE,
  weekdaysOnly: true,
  peakWindows: DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
  peak: {
    cacheHit: '0.014',
    cacheMiss: '0.44',
    completion: '1.32',
  },
  offPeak: {
    cacheHit: '0.007',
    cacheMiss: '0.22',
    completion: '0.66',
  },
}

export const DEEPSEEK_FLASH_PEAK_OFFPEAK_FORM: PeakOffPeakFormValues = {
  ...DEFAULT_PEAK_OFFPEAK_FORM,
  peakWindows: DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
  peak: { ...DEFAULT_PEAK_OFFPEAK_FORM.peak },
  offPeak: { ...DEFAULT_PEAK_OFFPEAK_FORM.offPeak },
}

export const DEEPSEEK_PRO_PEAK_OFFPEAK_FORM: PeakOffPeakFormValues = {
  timezone: DEFAULT_PEAK_OFFPEAK_TIMEZONE,
  weekdaysOnly: true,
  peakWindows: DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w })),
  peak: {
    cacheHit: '0.044',
    cacheMiss: '1.32',
    completion: '3.96',
  },
  offPeak: {
    cacheHit: '0.022',
    cacheMiss: '0.66',
    completion: '1.98',
  },
}

export function clonePeakOffPeakForm(
  form: PeakOffPeakFormValues
): PeakOffPeakFormValues {
  return {
    timezone: form.timezone,
    weekdaysOnly: form.weekdaysOnly,
    peakWindows: form.peakWindows.map((w) => ({ ...w })),
    peak: { ...form.peak },
    offPeak: { ...form.offPeak },
  }
}

export function peakOffPeakConfigToForm(
  cfg?: PeakOffPeakConfig | null
): PeakOffPeakFormValues {
  if (!cfg) return clonePeakOffPeakForm(DEFAULT_PEAK_OFFPEAK_FORM)
  const windows =
    cfg.peak_windows?.length > 0
      ? cfg.peak_windows.map((w) => ({
          start: w.start || '',
          end: w.end || '',
        }))
      : DEFAULT_PEAK_WINDOWS.map((w) => ({ ...w }))
  return {
    timezone: cfg.timezone || DEFAULT_PEAK_OFFPEAK_TIMEZONE,
    weekdaysOnly: cfg.weekdays_only !== false,
    peakWindows: windows,
    peak: {
      cacheHit: String(cfg.peak?.cache_hit ?? ''),
      cacheMiss: String(cfg.peak?.cache_miss ?? ''),
      completion: String(cfg.peak?.completion ?? ''),
    },
    offPeak: {
      cacheHit: String(cfg.off_peak?.cache_hit ?? ''),
      cacheMiss: String(cfg.off_peak?.cache_miss ?? ''),
      completion: String(cfg.off_peak?.completion ?? ''),
    },
  }
}

export function peakOffPeakFormToConfig(
  form: PeakOffPeakFormValues
): PeakOffPeakConfig | null {
  const parsePrice = (value: string) => {
    const num = toNumberOrNull(value)
    return num !== null && num >= 0 ? num : null
  }

  const peakCacheHit = parsePrice(form.peak.cacheHit)
  const peakCacheMiss = parsePrice(form.peak.cacheMiss)
  const peakCompletion = parsePrice(form.peak.completion)
  const offCacheHit = parsePrice(form.offPeak.cacheHit)
  const offCacheMiss = parsePrice(form.offPeak.cacheMiss)
  const offCompletion = parsePrice(form.offPeak.completion)

  if (
    peakCacheHit === null ||
    peakCacheMiss === null ||
    peakCompletion === null ||
    offCacheHit === null ||
    offCacheMiss === null ||
    offCompletion === null
  ) {
    return null
  }

  const windows = form.peakWindows
    .map((w) => ({
      start: w.start.trim(),
      end: w.end.trim(),
    }))
    .filter((w) => w.start !== '' && w.end !== '')

  if (windows.length === 0) return null

  return {
    timezone: form.timezone.trim() || DEFAULT_PEAK_OFFPEAK_TIMEZONE,
    weekdays_only: form.weekdaysOnly,
    peak_windows: windows,
    peak: {
      cache_hit: peakCacheHit,
      cache_miss: peakCacheMiss,
      completion: peakCompletion,
    },
    off_peak: {
      cache_hit: offCacheHit,
      cache_miss: offCacheMiss,
      completion: offCompletion,
    },
  }
}

export const PEAK_OFFPEAK_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export function fillOffPeakFromPeak(
  peak: PeakOffPeakTokenPriceForm
): PeakOffPeakTokenPriceForm {
  const scale = (value: string) => {
    const num = toNumberOrNull(value)
    if (num === null) return ''
    return formatPricingNumber(num * 0.5)
  }
  return {
    cacheHit: scale(peak.cacheHit),
    cacheMiss: scale(peak.cacheMiss),
    completion: scale(peak.completion),
  }
}

export type LaneKey =
  | 'completion'
  | 'cache'
  | 'createCache'
  | 'image'
  | 'audioInput'
  | 'audioOutput'

export type ModelRatioData = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: PricingMode
  billingExpr?: string
  requestRuleExpr?: string
  fallbackPrice?: string
  sizePrices?: DurationSizePriceRow[]
  peakOffPeak?: PeakOffPeakFormValues
  perCharsPrice?: string
}

export type PreviewRow = {
  key: string
  label: string
  value: string
  multiline?: boolean
}

export const numericDraftRegex = /^(\d+(\.\d*)?|\.\d*)?$/

export const EMPTY_LANE_PRICES: Record<LaneKey, string> = {
  completion: '',
  cache: '',
  createCache: '',
  image: '',
  audioInput: '',
  audioOutput: '',
}

export const EMPTY_LANE_ENABLED: Record<LaneKey, boolean> = {
  completion: false,
  cache: false,
  createCache: false,
  image: false,
  audioInput: false,
  audioOutput: false,
}

export const ratioFieldByLane: Record<LaneKey, keyof ModelPricingFormValues> = {
  completion: 'completionRatio',
  cache: 'cacheRatio',
  createCache: 'createCacheRatio',
  image: 'imageRatio',
  audioInput: 'audioRatio',
  audioOutput: 'audioCompletionRatio',
}

export const laneConfigs: Array<{
  key: LaneKey
  titleKey: string
  descriptionKey: string
  placeholder: string
}> = [
  {
    key: 'completion',
    titleKey: 'Completion price',
    descriptionKey: 'Output token price for generated tokens.',
    placeholder: '15',
  },
  {
    key: 'cache',
    titleKey: 'Cache read price',
    descriptionKey: 'Token price for cache reads.',
    placeholder: '0.3',
  },
  {
    key: 'createCache',
    titleKey: 'Cache write price',
    descriptionKey: 'Token price for creating cache entries.',
    placeholder: '3.75',
  },
  {
    key: 'image',
    titleKey: 'Image input price',
    descriptionKey: 'Token price for image input.',
    placeholder: '2.5',
  },
  {
    key: 'audioInput',
    titleKey: 'Audio input price',
    descriptionKey: 'Token price for audio input.',
    placeholder: '3.81',
  },
  {
    key: 'audioOutput',
    titleKey: 'Audio output price',
    descriptionKey: 'Token price for audio output.',
    placeholder: '15.11',
  },
]

export function hasValue(value: unknown): boolean {
  return (
    value !== '' && value !== null && value !== undefined && value !== false
  )
}

export function toNumberOrNull(value: unknown): number | null {
  if (!hasValue(value) && value !== 0) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function ratioToBasePrice(ratio: unknown): string {
  const num = toNumberOrNull(ratio)
  if (num === null) return ''
  return formatPricingNumber(num * 2)
}

function deriveLanePrice(
  ratio: unknown,
  denominator: unknown,
  fallback = ''
): string {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = toNumberOrNull(denominator)
  if (ratioNumber === null || denominatorNumber === null) return fallback
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

export function createInitialLaneState(data?: ModelRatioData | null) {
  if (!data) {
    return {
      promptPrice: '',
      prices: { ...EMPTY_LANE_PRICES },
      enabled: { ...EMPTY_LANE_ENABLED },
    }
  }

  const promptPrice = ratioToBasePrice(data.ratio)
  const audioInputPrice = deriveLanePrice(data.audioRatio, promptPrice)
  const prices: Record<LaneKey, string> = {
    completion: deriveLanePrice(data.completionRatio, promptPrice),
    cache: deriveLanePrice(data.cacheRatio, promptPrice),
    createCache: deriveLanePrice(data.createCacheRatio, promptPrice),
    image: deriveLanePrice(data.imageRatio, promptPrice),
    audioInput: audioInputPrice,
    audioOutput: deriveLanePrice(data.audioCompletionRatio, audioInputPrice),
  }

  return {
    promptPrice,
    prices,
    enabled: {
      completion: hasValue(data.completionRatio),
      cache: hasValue(data.cacheRatio),
      createCache: hasValue(data.createCacheRatio),
      image: hasValue(data.imageRatio),
      audioInput: hasValue(data.audioRatio),
      audioOutput: hasValue(data.audioCompletionRatio),
    },
  }
}

export function buildPreviewRows(
  values: ModelPricingFormValues,
  mode: PricingMode,
  billingExpr: string,
  requestRuleExpr: string,
  promptPrice: string,
  lanePrices: Record<LaneKey, string>,
  laneEnabled: Record<LaneKey, boolean>,
  t: (key: string) => string,
  fallbackPrice = '',
  sizePrices: DurationSizePriceRow[] = [],
  peakOffPeak: PeakOffPeakFormValues = DEFAULT_PEAK_OFFPEAK_FORM,
  perCharsPrice = '',
  currency: PricingCurrency = USD_PRICING_CURRENCY
): PreviewRow[] {
  if (mode === 'tiered_expr') {
    const effectiveExpr = combineBillingExpr(billingExpr, requestRuleExpr)
    return [
      { key: 'mode', label: t('Pricing'), value: t('Expression') },
      {
        key: 'expr',
        label: `${t('Expression')} (USD)`,
        value: effectiveExpr || t('Empty'),
        multiline: true,
      },
    ]
  }

  if (mode === 'per_duration') {
    const sizeLines = sizePrices
      .filter((row) => row.size.trim() !== '')
      .map(
        (row) =>
          `${row.size.trim()}: ${formatPricingAmount(row.price || '0', currency)}/s`
      )
    return [
      { key: 'mode', label: 'BillingMode', value: 'per_duration' },
      {
        key: 'fallback',
        label: t('Fallback price'),
        value: fallbackPrice
          ? `${formatPricingAmount(fallbackPrice, currency)}/s`
          : t('Empty'),
      },
      {
        key: 'sizes',
        label: t('Size prices'),
        value: sizeLines.length > 0 ? sizeLines.join('\n') : t('Empty'),
        multiline: true,
      },
    ]
  }

  if (mode === 'per_chars') {
    return [
      { key: 'mode', label: 'BillingMode', value: 'per_chars' },
      {
        key: 'perCharsPrice',
        label: t('Price per 10K characters'),
        value: perCharsPrice
          ? `${formatPricingAmount(perCharsPrice, currency)}/10K chars`
          : t('Empty'),
      },
    ]
  }

  if (mode === 'peak_offpeak') {
    const windowLines = peakOffPeak.peakWindows
      .filter((w) => w.start.trim() && w.end.trim())
      .map((w) => `${w.start.trim()}-${w.end.trim()}`)
    return [
      { key: 'mode', label: 'BillingMode', value: 'peak_offpeak' },
      {
        key: 'timezone',
        label: t('Timezone'),
        value: peakOffPeak.timezone || t('Empty'),
      },
      {
        key: 'weekdays',
        label: t('Weekdays only'),
        value: peakOffPeak.weekdaysOnly ? t('Yes') : t('No'),
      },
      {
        key: 'windows',
        label: t('Peak windows'),
        value: windowLines.length > 0 ? windowLines.join(', ') : t('Empty'),
      },
      {
        key: 'peak',
        label: t('Peak'),
        value: `in ${formatPricingAmount(peakOffPeak.peak.cacheMiss || '0', currency)} / out ${formatPricingAmount(peakOffPeak.peak.completion || '0', currency)}`,
      },
      {
        key: 'offPeak',
        label: t('Off-peak'),
        value: `in ${formatPricingAmount(peakOffPeak.offPeak.cacheMiss || '0', currency)} / out ${formatPricingAmount(peakOffPeak.offPeak.completion || '0', currency)}`,
      },
    ]
  }

  if (mode === 'per-request') {
    return [
      {
        key: 'price',
        label: t('Fixed price'),
        value: values.price
          ? formatPricingAmount(values.price, currency)
          : t('Empty'),
      },
    ]
  }

  return [
    {
      key: 'inputPrice',
      label: t('Input price'),
      value: promptPrice
        ? formatPricingAmount(promptPrice, currency)
        : t('Empty'),
    },
    {
      key: 'completion',
      label: t('Completion price'),
      value:
        laneEnabled.completion && lanePrices.completion
          ? formatPricingAmount(lanePrices.completion, currency)
          : t('Empty'),
    },
    {
      key: 'cache',
      label: t('Cache read price'),
      value:
        laneEnabled.cache && lanePrices.cache
          ? formatPricingAmount(lanePrices.cache, currency)
          : t('Empty'),
    },
    {
      key: 'createCache',
      label: t('Cache write price'),
      value:
        laneEnabled.createCache && lanePrices.createCache
          ? formatPricingAmount(lanePrices.createCache, currency)
          : t('Empty'),
    },
    {
      key: 'image',
      label: t('Image input price'),
      value:
        laneEnabled.image && lanePrices.image
          ? formatPricingAmount(lanePrices.image, currency)
          : t('Empty'),
    },
    {
      key: 'audio',
      label: t('Audio input price'),
      value:
        laneEnabled.audioInput && lanePrices.audioInput
          ? formatPricingAmount(lanePrices.audioInput, currency)
          : t('Empty'),
    },
    {
      key: 'audioCompletion',
      label: t('Audio output price'),
      value:
        laneEnabled.audioOutput && lanePrices.audioOutput
          ? formatPricingAmount(lanePrices.audioOutput, currency)
          : t('Empty'),
    },
  ]
}
