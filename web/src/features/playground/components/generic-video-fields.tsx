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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { GenericCapabilities } from '../../types'
import type { GenericFormState } from '../../lib/video/build-video-request'

interface GenericVideoFieldsProps {
  capabilities: GenericCapabilities
  state: GenericFormState
  onChange: (patch: Partial<GenericFormState>) => void
}

export function GenericVideoFields({
  capabilities,
  state,
  onChange,
}: GenericVideoFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Resolution')}</Label>
        <div className='flex gap-2'>
          {capabilities.supported_sizes.map((s) => (
            <Button
              key={s}
              className='flex-1'
              size='sm'
              type='button'
              variant={state.size === s ? 'default' : 'outline'}
              onClick={() => onChange({ size: s })}
            >
              {s}
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
          <p className='text-muted-foreground mt-2 text-xs'>
            {t('Uses the standard video generation request fields for this model.')}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
