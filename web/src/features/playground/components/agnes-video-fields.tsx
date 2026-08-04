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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { AgnesVideoFormState } from '../../lib/video/build-video-request'
import type { AgnesVideoCapabilities } from '../../types'

interface AgnesVideoFieldsProps {
  capabilities: AgnesVideoCapabilities
  state: AgnesVideoFormState
  onChange: (patch: Partial<AgnesVideoFormState>) => void
}

export function AgnesVideoFields(props: AgnesVideoFieldsProps) {
  const { t } = useTranslation()
  const frameRateMin = props.capabilities.frame_rate_range[0]
  const frameRateMax = props.capabilities.frame_rate_range[1]

  return (
    <>
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Resolution')}</Label>
        <div className='flex flex-wrap gap-2'>
          {props.capabilities.supported_sizes.map((size) => (
            <Button
              key={size}
              className='min-w-[4.5rem] flex-1'
              size='sm'
              type='button'
              variant={props.state.size === size ? 'default' : 'outline'}
              onClick={() => props.onChange({ size })}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>{t('Aspect Ratio')}</Label>
        <div className='flex flex-wrap gap-2'>
          {props.capabilities.supported_ratios.map((ratio) => (
            <Button
              key={ratio}
              className='min-w-[3.5rem] flex-1'
              size='sm'
              type='button'
              variant={props.state.ratio === ratio ? 'default' : 'outline'}
              onClick={() => props.onChange({ ratio })}
            >
              {ratio}
            </Button>
          ))}
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>
          {t('Duration')}: {props.state.duration}s
        </Label>
        <Slider
          max={props.capabilities.duration_range[1]}
          min={props.capabilities.duration_range[0]}
          step={1}
          value={[props.state.duration]}
          onValueChange={(v) => {
            const arr = Array.isArray(v) ? v : [v]
            props.onChange({ duration: arr[0] as number, numFrames: undefined })
          }}
        />
        <div className='text-muted-foreground flex justify-between text-xs'>
          <span>{props.capabilities.duration_range[0]}s</span>
          <span>{props.capabilities.duration_range[1]}s</span>
        </div>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>
          {t('Frame Rate')}: {props.state.frameRate} fps
        </Label>
        <Slider
          max={frameRateMax}
          min={frameRateMin}
          step={1}
          value={[props.state.frameRate]}
          onValueChange={(v) => {
            const arr = Array.isArray(v) ? v : [v]
            props.onChange({ frameRate: arr[0] as number })
          }}
        />
        <div className='text-muted-foreground flex justify-between text-xs'>
          <span>
            {frameRateMin} fps
          </span>
          <span>
            {frameRateMax} fps
          </span>
        </div>
      </div>

      <Collapsible>
        <CollapsibleTrigger className='text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 text-sm transition-colors [&[data-panel-open]>svg]:rotate-180'>
          <ChevronDownIcon className='size-4 transition-transform' />
          {t('Advanced Settings')}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='mt-2 flex flex-col gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label className='text-sm font-normal'>{t('Number of Frames')}</Label>
              <Input
                inputMode='numeric'
                placeholder={t('Auto from duration and frame rate (8n+1)')}
                value={props.state.numFrames ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  if (raw === '') {
                    props.onChange({ numFrames: undefined })
                    return
                  }
                  const parsed = Number.parseInt(raw, 10)
                  if (Number.isFinite(parsed)) {
                    props.onChange({ numFrames: parsed })
                  }
                }}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Must follow the 8n+1 rule (e.g. 121, 241). Leave empty to derive from duration.')}
              </p>
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label className='text-sm font-normal'>{t('Seed')}</Label>
              <Input
                inputMode='numeric'
                placeholder={t('Optional')}
                value={props.state.seed ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  if (raw === '') {
                    props.onChange({ seed: undefined })
                    return
                  }
                  const parsed = Number.parseInt(raw, 10)
                  if (Number.isFinite(parsed)) {
                    props.onChange({ seed: parsed })
                  }
                }}
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label className='text-sm font-normal'>{t('Negative Prompt')}</Label>
              <Input
                placeholder={t('Optional')}
                value={props.state.negativePrompt ?? ''}
                onChange={(e) =>
                  props.onChange({
                    negativePrompt: e.target.value || undefined,
                  })
                }
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label className='text-sm font-normal'>{t('Reference Image URL')}</Label>
              <Input
                placeholder={t('Optional image-to-video input')}
                value={props.state.image ?? ''}
                onChange={(e) =>
                  props.onChange({
                    image: e.target.value.trim() || undefined,
                  })
                }
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
