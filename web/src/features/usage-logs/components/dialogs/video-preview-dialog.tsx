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
import { Copy, ExternalLink, Film } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'

interface VideoPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoUrl: string
  taskId?: string
}

export function VideoPreviewDialog(props: VideoPreviewDialogProps) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!props.open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasError(false)
    setIsLoading(true)
  }, [props.open, props.videoUrl])

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(props.videoUrl)
    toast.success(t('Copied'))
  }

  const handleOpenInNewTab = () => {
    window.open(props.videoUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={
        <>
          <IconBadge tone='chart-4' size='sm'>
            <Film />
          </IconBadge>
          {t('Video Preview')}
        </>
      }
      description={
        props.taskId
          ? `${t('Task ID:')} ${props.taskId}`
          : t('View the generated video')
      }
      contentClassName='sm:max-w-3xl'
      titleClassName='flex items-center gap-2'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      {hasError ? (
        <div className='flex flex-col items-center gap-4 py-8 text-center'>
          <p className='text-muted-foreground text-sm'>
            {t('Video playback failed')}
          </p>
          <div className='flex flex-wrap items-center justify-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='h-7 gap-1 text-xs'
              onClick={handleOpenInNewTab}
            >
              <ExternalLink className='h-3 w-3' />
              {t('Open in new tab')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-7 gap-1 text-xs'
              onClick={handleCopyUrl}
            >
              <Copy className='h-3 w-3' />
              {t('Copy Link')}
            </Button>
          </div>
          <p className='text-muted-foreground max-w-full font-mono text-[11px] break-all'>
            {props.videoUrl}
          </p>
        </div>
      ) : (
        <div className='bg-muted/50 relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border'>
          {isLoading && (
            <Skeleton className='absolute inset-0 h-full w-full rounded-lg' />
          )}
          <video
            key={props.videoUrl}
            src={props.videoUrl}
            controls
            playsInline
            className='max-h-[70vh] w-full object-contain'
            onLoadStart={() => setIsLoading(true)}
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          />
        </div>
      )}
    </Dialog>
  )
}
