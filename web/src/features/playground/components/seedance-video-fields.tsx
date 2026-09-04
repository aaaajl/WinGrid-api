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
import { ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { SeedanceFormState } from '../lib/video/build-video-request'
import type { SeedanceCapabilities } from '../types'

interface SeedanceVideoFieldsProps {
  capabilities: SeedanceCapabilities
  state: SeedanceFormState
  onChange: (patch: Partial<SeedanceFormState>) => void
}

export function SeedanceVideoFields({
  capabilities,
  state,
  onChange,
}: SeedanceVideoFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Resolution')}</Label>
        <div className='flex flex-wrap gap-2'>
          {capabilities.supported_resolutions.map((size) => (
            <Button
              key={size}
              className='min-w-[4.5rem] flex-1'
              size='sm'
              type='button'
              variant={state.size === size ? 'default' : 'outline'}
              onClick={() => onChange({ size })}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>{t('Aspect Ratio')}</Label>
        <div className='flex gap-2'>
          {capabilities.supported_ratios.map((ratio) => (
            <Button
              key={ratio}
              className='flex-1'
              size='sm'
              type='button'
              variant={state.ratio === ratio ? 'default' : 'outline'}
              onClick={() => onChange({ ratio })}
            >
              {ratio}
            </Button>
          ))}
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>
          {t('Duration')}: {state.duration}s
        </Label>
        <Slider
          max={capabilities.duration_range[1]}
          min={capabilities.duration_range[0]}
          step={1}
          value={[state.duration]}
          onValueChange={(v) => {
            const arr = Array.isArray(v) ? v : [v]
            onChange({ duration: arr[0] as number })
          }}
        />
        <div className='text-muted-foreground flex justify-between text-xs'>
          <span>{capabilities.duration_range[0]}s</span>
          <span>{capabilities.duration_range[1]}s</span>
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 text-sm transition-colors [&[data-panel-open]>svg]:rotate-180'>
          <ChevronDownIcon className='size-4 transition-transform' />
          {t('Advanced Settings')}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='mt-2 flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>{t('Watermark')}</Label>
              <Switch
                size='sm'
                checked={state.watermark}
                onCheckedChange={(checked) => onChange({ watermark: checked })}
              />
            </div>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>{t('Camera Fixed')}</Label>
              <Switch
                size='sm'
                checked={state.cameraFixed}
                onCheckedChange={(checked) => onChange({ cameraFixed: checked })}
              />
            </div>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>{t('Generate Audio')}</Label>
              <Switch
                size='sm'
                checked={state.generateAudio}
                onCheckedChange={(checked) => onChange({ generateAudio: checked })}
              />
            </div>
            <div className='flex items-center justify-between gap-4'>
              <Label className='text-sm font-normal'>{t('Seed')}</Label>
              <Input
                type='number'
                className='h-8 w-32 text-sm'
                placeholder={t('Random')}
                value={state.seed ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onChange({ seed: v === '' ? undefined : Number(v) })
                }}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
