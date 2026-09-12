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
import { DownloadIcon, Trash2Icon, Volume2Icon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { SpeechHistoryItem } from '../types'

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/opus': 'opus',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/pcm': 'pcm',
}

function resolveSpeechExtension(item: SpeechHistoryItem): string {
  if (item.responseFormat) return item.responseFormat
  const mime = item.mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  return MIME_EXTENSIONS[mime] ?? 'mp3'
}

interface SpeechResultPreviewProps {
  item: SpeechHistoryItem
  onClose: () => void
}

export function SpeechResultPreview(props: SpeechResultPreviewProps) {
  const { t } = useTranslation()
  const meta = [props.item.model, props.item.voice, props.item.responseFormat]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className='border-border bg-background rounded-xl border shadow-sm'>
      <div className='flex items-start justify-between gap-3 border-b px-4 py-2'>
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground truncate text-xs'>{meta}</p>
          <p className='truncate text-sm'>{props.item.input}</p>
        </div>
        <Button
          aria-label={t('Close')}
          size='icon'
          type='button'
          variant='ghost'
          onClick={props.onClose}
        >
          <XIcon className='size-4' />
        </Button>
      </div>
      <div className='flex items-center gap-3 p-3'>
        <audio
          className='min-w-0 flex-1'
          controls
          preload='auto'
          src={props.item.audioDataUrl}
        />
        <a
          className='bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-xs font-medium'
          download={`speech-${props.item.id}.${resolveSpeechExtension(props.item)}`}
          href={props.item.audioDataUrl}
        >
          <DownloadIcon className='size-3.5' />
          {t('Download')}
        </a>
      </div>
    </div>
  )
}

interface SpeechHistoryListProps {
  items: SpeechHistoryItem[]
  onPreview: (item: SpeechHistoryItem) => void
  onRemove: (id: string) => void
  onClear: () => void
  onReuseInput: (input: string) => void
}

export function SpeechHistoryList(props: SpeechHistoryListProps) {
  const { t } = useTranslation()

  if (props.items.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-sm'>
        <Volume2Icon className='size-8 opacity-40' />
        <p>{t('No speech history yet')}</p>
        <p className='text-xs'>{t('Synthesized audio will appear here')}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium'>
          {t('History')} ({props.items.length})
        </p>
        <Button size='sm' type='button' variant='ghost' onClick={props.onClear}>
          <Trash2Icon className='mr-1 size-3.5' />
          {t('Clear')}
        </Button>
      </div>
      <div className='flex flex-col gap-2'>
        {props.items.map((item) => (
          <div
            key={item.id}
            className='hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors'
            onClick={() => props.onPreview(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                props.onPreview(item)
              }
            }}
            role='button'
            tabIndex={0}
          >
            <div className='bg-muted flex size-14 shrink-0 items-center justify-center rounded-md'>
              <Volume2Icon className='text-muted-foreground size-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm'>{item.input}</p>
              <p className='text-muted-foreground truncate text-xs'>
                {[item.model, item.voice, item.responseFormat]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className='flex shrink-0 gap-1'>
              <Button
                size='sm'
                type='button'
                variant='ghost'
                onClick={(e) => {
                  e.stopPropagation()
                  props.onReuseInput(item.input)
                }}
              >
                {t('Reuse')}
              </Button>
              <Button
                aria-label={t('Delete')}
                size='icon'
                type='button'
                variant='ghost'
                onClick={(e) => {
                  e.stopPropagation()
                  props.onRemove(item.id)
                }}
              >
                <Trash2Icon className='size-3.5' />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
