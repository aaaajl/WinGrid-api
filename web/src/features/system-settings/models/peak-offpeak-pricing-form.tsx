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

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { COMMON_TIMEZONES } from '@/features/pricing/lib/billing-expr'

import {
  DEEPSEEK_FLASH_PEAK_OFFPEAK_FORM,
  DEEPSEEK_PRO_PEAK_OFFPEAK_FORM,
  clonePeakOffPeakForm,
  fillOffPeakFromPeak,
  numericDraftRegex,
  type PeakOffPeakFormValues,
  type PeakOffPeakTokenPriceForm,
} from './model-pricing-core'

type PeakOffPeakPricingFormProps = {
  value: PeakOffPeakFormValues
  onChange: (next: PeakOffPeakFormValues) => void
}

function PriceFields(props: {
  title: string
  prices: PeakOffPeakTokenPriceForm
  onChange: (next: PeakOffPeakTokenPriceForm) => void
  action?: React.ReactNode
}) {
  const { t } = useTranslation()

  const updateField = (
    field: keyof PeakOffPeakTokenPriceForm,
    raw: string
  ) => {
    if (!numericDraftRegex.test(raw)) return
    props.onChange({ ...props.prices, [field]: raw })
  }

  return (
    <Field>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <FieldLabel className='m-0'>{props.title}</FieldLabel>
        {props.action}
      </div>
      <div className='mt-2 grid gap-2 sm:grid-cols-3'>
        <InputGroup>
          <InputGroupAddon>$</InputGroupAddon>
          <InputGroupInput
            inputMode='decimal'
            placeholder='0.014'
            value={props.prices.cacheHit}
            onChange={(event) => updateField('cacheHit', event.target.value)}
            aria-label={t('Cache hit')}
          />
          <InputGroupAddon align='inline-end'>
            {t('Cache hit')}
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupAddon>$</InputGroupAddon>
          <InputGroupInput
            inputMode='decimal'
            placeholder='0.44'
            value={props.prices.cacheMiss}
            onChange={(event) => updateField('cacheMiss', event.target.value)}
            aria-label={t('Cache miss')}
          />
          <InputGroupAddon align='inline-end'>
            {t('Cache miss')}
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupAddon>$</InputGroupAddon>
          <InputGroupInput
            inputMode='decimal'
            placeholder='1.32'
            value={props.prices.completion}
            onChange={(event) => updateField('completion', event.target.value)}
            aria-label={t('Completion')}
          />
          <InputGroupAddon align='inline-end'>
            {t('Completion')}
          </InputGroupAddon>
        </InputGroup>
      </div>
      <FieldDescription>
        {t('USD price per 1M tokens for cache hit, cache miss, and completion.')}
      </FieldDescription>
    </Field>
  )
}

export function PeakOffPeakPricingForm(props: PeakOffPeakPricingFormProps) {
  const { t } = useTranslation()
  const form = props.value

  const patch = (partial: Partial<PeakOffPeakFormValues>) => {
    props.onChange({ ...form, ...partial })
  }

  return (
    <FieldGroup className='gap-5'>
      <Field>
        <FieldLabel>{t('DeepSeek preset')}</FieldLabel>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='secondary'
            onClick={() =>
              props.onChange(
                clonePeakOffPeakForm(DEEPSEEK_FLASH_PEAK_OFFPEAK_FORM)
              )
            }
          >
            DeepSeek Flash
          </Button>
          <Button
            type='button'
            variant='secondary'
            onClick={() =>
              props.onChange(
                clonePeakOffPeakForm(DEEPSEEK_PRO_PEAK_OFFPEAK_FORM)
              )
            }
          >
            DeepSeek Pro
          </Button>
        </div>
        <FieldDescription>
          {t('Fills timezone, peak windows, and peak/off-peak prices.')}
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('Timezone')}</FieldLabel>
        <Select
          value={form.timezone}
          onValueChange={(timezone) => {
            if (timezone) patch({ timezone })
          }}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder={t('Timezone')} />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5'>
        <div className='min-w-0'>
          <div className='text-sm font-medium'>{t('Weekdays only')}</div>
          <p className='text-muted-foreground text-xs'>
            {t('Weekends use off-peak prices for the entire day.')}
          </p>
        </div>
        <Switch
          checked={form.weekdaysOnly}
          onCheckedChange={(checked) => patch({ weekdaysOnly: checked })}
        />
      </div>

      <Field>
        <FieldLabel>{t('Peak windows')}</FieldLabel>
        <FieldDescription>
          {t('Local time ranges that use peak prices (HH:MM).')}
        </FieldDescription>
        <div className='mt-2 grid gap-2'>
          {form.peakWindows.map((row, index) => (
            <div
              key={`peak-window-${index}`}
              className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2'
            >
              <Input
                placeholder='09:00'
                value={row.start}
                onChange={(event) => {
                  const next = [...form.peakWindows]
                  next[index] = { ...row, start: event.target.value }
                  patch({ peakWindows: next })
                }}
              />
              <Input
                placeholder='12:00'
                value={row.end}
                onChange={(event) => {
                  const next = [...form.peakWindows]
                  next[index] = { ...row, end: event.target.value }
                  patch({ peakWindows: next })
                }}
              />
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  patch({
                    peakWindows: form.peakWindows.filter((_, i) => i !== index),
                  })
                }}
              >
                {t('Remove')}
              </Button>
            </div>
          ))}
          <Button
            type='button'
            variant='secondary'
            onClick={() =>
              patch({
                peakWindows: [...form.peakWindows, { start: '', end: '' }],
              })
            }
          >
            {t('Add peak window')}
          </Button>
        </div>
      </Field>

      <PriceFields
        title={t('Peak')}
        prices={form.peak}
        onChange={(peak) => patch({ peak })}
      />

      <PriceFields
        title={t('Off-peak')}
        prices={form.offPeak}
        onChange={(offPeak) => patch({ offPeak })}
        action={
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => patch({ offPeak: fillOffPeakFromPeak(form.peak) })}
          >
            {t('Fill off-peak from peak × 0.5')}
          </Button>
        }
      />
    </FieldGroup>
  )
}
