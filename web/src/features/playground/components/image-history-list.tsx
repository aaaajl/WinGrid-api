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
import { DownloadIcon, ImageIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ImageHistoryItem } from '../types'

function resolveImageSrc(image: {
  url?: string
  b64_json?: string
}): string | null {
  if (image.url) return image.url
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`
  return null
}

interface ImageResultPreviewProps {
  item: ImageHistoryItem
  onClose: () => void
}

export function ImageResultPreview(props: ImageResultPreviewProps) {
  const { t } = useTranslation()

  return (
    <div className='border-border bg-background rounded-xl border shadow-sm'>
      <div className='flex items-start justify-between gap-3 border-b px-4 py-2'>
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground truncate text-xs'>
            {props.item.model}
            {props.item.size ? ` · ${props.item.size}` : ''}
          </p>
          <p className='truncate text-sm'>{props.item.prompt}</p>
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
      <div className='grid gap-3 p-3 sm:grid-cols-2'>
        {props.item.images.map((image, index) => {
          const src = resolveImageSrc(image)
          if (!src) return null
          return (
            <div
              key={image.id}
              className='bg-muted relative overflow-hidden rounded-lg'
            >
              <img
                alt={image.revised_prompt || props.item.prompt}
                className='aspect-square w-full object-contain'
                src={src}
              />
              <a
                className='bg-secondary text-secondary-foreground hover:bg-secondary/80 absolute right-2 bottom-2 inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium'
                download={`image-${index + 1}.png`}
                href={src}
              >
                <DownloadIcon className='size-3.5' />
                {t('Download')}
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ImageHistoryListProps {
  items: ImageHistoryItem[]
  onPreview: (item: ImageHistoryItem) => void
  onRemove: (id: string) => void
  onClear: () => void
  onReusePrompt: (prompt: string) => void
}

export function ImageHistoryList(props: ImageHistoryListProps) {
  const { t } = useTranslation()

  if (props.items.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-sm'>
        <ImageIcon className='size-8 opacity-40' />
        <p>{t('No image history yet')}</p>
        <p className='text-xs'>{t('Generated images will appear here')}</p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium'>
          {t('History')} ({props.items.length})
        </p>
        <Button
          size='sm'
          type='button'
          variant='ghost'
          onClick={props.onClear}
        >
          <Trash2Icon className='mr-1 size-3.5' />
          {t('Clear')}
        </Button>
      </div>
      <div className='flex flex-col gap-2'>
        {props.items.map((item) => {
          const thumb = resolveImageSrc(item.images[0] ?? {})
          return (
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
              <div className='bg-muted size-14 shrink-0 overflow-hidden rounded-md'>
                {thumb ? (
                  <img
                    alt=''
                    className='size-full object-cover'
                    src={thumb}
                  />
                ) : (
                  <div className='flex size-full items-center justify-center'>
                    <ImageIcon className='text-muted-foreground size-5' />
                  </div>
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm'>{item.prompt}</p>
                <p className='text-muted-foreground truncate text-xs'>
                  {item.model}
                  {item.size ? ` · ${item.size}` : ''}
                  {` · ${item.images.length}`}
                </p>
              </div>
              <div className='flex shrink-0 gap-1'>
                <Button
                  size='sm'
                  type='button'
                  variant='ghost'
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onReusePrompt(item.prompt)
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
          )
        })}
      </div>
    </div>
  )
}
