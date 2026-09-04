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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { MiniMaxH3FormState } from '../lib/video/build-video-request'
import type { MiniMaxH3Capabilities } from '../types'

interface MiniMaxH3VideoFieldsProps {
  capabilities: MiniMaxH3Capabilities
  state: MiniMaxH3FormState
  onChange: (patch: Partial<MiniMaxH3FormState>) => void
}

export function MiniMaxH3VideoFields(props: MiniMaxH3VideoFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Resolution')}</Label>
        <div className='flex flex-wrap gap-2'>
          {props.capabilities.supported_resolutions.map((resolution) => (
            <Button
              key={resolution}
              className='min-w-[4.5rem] flex-1'
              size='sm'
              type='button'
              variant={
                props.state.resolution === resolution ? 'default' : 'outline'
              }
              onClick={() => props.onChange({ resolution })}
            >
              {resolution}
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
            props.onChange({ duration: arr[0] as number })
          }}
        />
        <div className='text-muted-foreground flex justify-between text-xs'>
          <span>{props.capabilities.duration_range[0]}s</span>
          <span>{props.capabilities.duration_range[1]}s</span>
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
              <Label className='text-sm font-normal'>{t('AIGC Watermark')}</Label>
              <Switch
                size='sm'
                checked={props.state.aigcWatermark}
                onCheckedChange={(checked) =>
                  props.onChange({ aigcWatermark: checked })
                }
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
