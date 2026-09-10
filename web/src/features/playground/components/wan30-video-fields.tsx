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
import { ChevronDownIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

import type {
  Wan30FormState,
  Wan30Mode,
  Wan30ReferenceType,
} from '../lib/video/build-video-request'
import type { Wan30VideoCapabilities } from '../types'

interface Wan30VideoFieldsProps {
  capabilities: Wan30VideoCapabilities
  state: Wan30FormState
  onChange: (patch: Partial<Wan30FormState>) => void
}

const MODES: Array<{ value: Wan30Mode; label: string }> = [
  { value: 't2v', label: 'Text to video' },
  { value: 'first_frame', label: 'First frame' },
  { value: 'first_last_frame', label: 'First and last frames' },
  { value: 'reference', label: 'Reference media' },
  { value: 'file', label: 'File reference' },
  { value: 'link', label: 'Web page reference' },
]

const REFERENCE_TYPES: Array<{ value: Wan30ReferenceType; label: string }> = [
  { value: 'reference_image', label: 'Reference image' },
  { value: 'reference_video', label: 'Reference video' },
  { value: 'reference_audio', label: 'Reference audio' },
]

const REFERENCE_LABELS: Record<Wan30ReferenceType, string> = {
  reference_image: 'Reference image',
  reference_video: 'Reference video',
  reference_audio: 'Reference audio',
}

export function Wan30VideoFields(props: Wan30VideoFieldsProps) {
  const { t } = useTranslation()

  const changeMode = (mode: Wan30Mode) => {
    props.onChange({
      mode,
      firstFrameUrl: undefined,
      lastFrameUrl: undefined,
      references: [],
      fileUrl: undefined,
      linkUrl: undefined,
    })
  }

  const updateReference = (
    index: number,
    patch: Partial<Wan30FormState['references'][number]>
  ) => {
    props.onChange({
      references: props.state.references.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    })
  }

  const removeReference = (index: number) => {
    props.onChange({
      references: props.state.references.filter(
        (_item, itemIndex) => itemIndex !== index
      ),
    })
  }

  return (
    <>
      <div className='flex flex-col gap-1.5'>
        <Label>{t('Generation mode')}</Label>
        <Select
          value={props.state.mode}
          onValueChange={(value) => {
            if (value) changeMode(value as Wan30Mode)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {t(mode.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {props.state.mode === 'first_frame' && (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='wan30-first-frame'>{t('First frame URL')}</Label>
          <Input
            id='wan30-first-frame'
            placeholder={t('Public URL, OSS URL, or image data URL')}
            value={props.state.firstFrameUrl ?? ''}
            onChange={(event) =>
              props.onChange({ firstFrameUrl: event.target.value })
            }
          />
        </div>
      )}

      {props.state.mode === 'first_last_frame' && (
        <div className='grid gap-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='wan30-first-frame'>{t('First frame URL')}</Label>
            <Input
              id='wan30-first-frame'
              placeholder={t('Public URL, OSS URL, or image data URL')}
              value={props.state.firstFrameUrl ?? ''}
              onChange={(event) =>
                props.onChange({ firstFrameUrl: event.target.value })
              }
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='wan30-last-frame'>{t('Last frame URL')}</Label>
            <Input
              id='wan30-last-frame'
              placeholder={t('Public URL, OSS URL, or image data URL')}
              value={props.state.lastFrameUrl ?? ''}
              onChange={(event) =>
                props.onChange({ lastFrameUrl: event.target.value })
              }
            />
          </div>
        </div>
      )}

      {props.state.mode === 'reference' && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <Label>{t('Reference media')}</Label>
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={() =>
                props.onChange({
                  references: [
                    ...props.state.references,
                    {
                      id: `reference-${Date.now()}-${props.state.references.length}`,
                      type: 'reference_image',
                      url: '',
                    },
                  ],
                })
              }
            >
              <PlusIcon className='size-3.5' />
              {t('Add reference')}
            </Button>
          </div>
          {props.state.references.length === 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('Add images, videos, or audio that the prompt can reference.')}
            </p>
          )}
          {props.state.references.map((item, index) => (
            <div
              key={item.id}
              className='bg-muted/40 grid gap-2 rounded-md p-2'
            >
              <div className='flex gap-2'>
                <Select
                  value={item.type}
                  onValueChange={(value) => {
                    if (value) {
                      updateReference(index, {
                        type: value as Wan30ReferenceType,
                      })
                    }
                  }}
                >
                  <SelectTrigger className='flex-1'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  aria-label={t('Remove reference')}
                  size='icon-sm'
                  type='button'
                  variant='ghost'
                  onClick={() => removeReference(index)}
                >
                  <Trash2Icon className='size-4' />
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                {t(REFERENCE_LABELS[item.type])}{' '}
                {
                  props.state.references
                    .slice(0, index + 1)
                    .filter((candidate) => candidate.type === item.type).length
                }
              </p>
              <Input
                aria-label={t('Reference URL')}
                placeholder={t('Reference URL')}
                value={item.url}
                onChange={(event) =>
                  updateReference(index, { url: event.target.value })
                }
              />
            </div>
          ))}
        </div>
      )}

      {props.state.mode === 'file' && (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='wan30-file-url'>{t('File URL')}</Label>
          <Input
            id='wan30-file-url'
            placeholder={t('Public or OSS URL for a supported document')}
            value={props.state.fileUrl ?? ''}
            onChange={(event) =>
              props.onChange({ fileUrl: event.target.value })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Supports documents, spreadsheets, slides, PDF, text, and Markdown.'
            )}
          </p>
        </div>
      )}

      {props.state.mode === 'link' && (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='wan30-link-url'>{t('Web page URL')}</Label>
          <Input
            id='wan30-link-url'
            placeholder='https://example.com/article'
            value={props.state.linkUrl ?? ''}
            onChange={(event) =>
              props.onChange({ linkUrl: event.target.value })
            }
          />
        </div>
      )}

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
              {ratio === 'adaptive' ? t('Adaptive') : ratio}
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
          onValueChange={(value) => {
            const values = Array.isArray(value) ? value : [value]
            props.onChange({ duration: values[0] as number })
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
              <Label className='text-sm font-normal'>
                {t('Generate Audio')}
              </Label>
              <Switch
                size='sm'
                checked={props.state.audio}
                onCheckedChange={(audio) => props.onChange({ audio })}
              />
            </div>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>
                {t('Prompt Extend')}
              </Label>
              <Switch
                size='sm'
                checked={props.state.promptExtend}
                onCheckedChange={(promptExtend) =>
                  props.onChange({ promptExtend })
                }
              />
            </div>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-normal'>{t('Watermark')}</Label>
              <Switch
                size='sm'
                checked={props.state.watermark}
                onCheckedChange={(watermark) => props.onChange({ watermark })}
              />
            </div>
            <div className='flex items-center justify-between gap-4'>
              <Label className='text-sm font-normal'>{t('Seed')}</Label>
              <Input
                className='h-8 w-36 text-sm'
                max={2147483647}
                min={0}
                placeholder={t('Random')}
                type='number'
                value={props.state.seed ?? ''}
                onChange={(event) =>
                  props.onChange({
                    seed:
                      event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
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
