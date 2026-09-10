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
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import {
  AnnouncementsContent,
  NoticeContent,
  type AnnouncementItem,
} from '@/components/notification-popover'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NoticeDialogTab } from '@/lib/notice-auto-show'

type NoticeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseToday: () => void
  activeTab: NoticeDialogTab
  onTabChange: (tab: NoticeDialogTab) => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
}

export function NoticeDialog(props: NoticeDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('System Announcements')}
      description={t('Latest platform updates and notices')}
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={props.onCloseToday}
          >
            {t('Close Today')}
          </Button>
          <Button type='button' onClick={() => props.onOpenChange(false)}>
            {t('Close')}
          </Button>
        </>
      }
    >
      <Tabs
        value={props.activeTab}
        onValueChange={props.onTabChange as (value: string) => void}
      >
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='notice' className='gap-1.5'>
            <Bell className='size-3.5' />
            {t('Notice')}
          </TabsTrigger>
          <TabsTrigger value='announcements' className='gap-1.5'>
            <Megaphone className='size-3.5' />
            {t('Timeline')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='notice' className='mt-2'>
          <NoticeContent
            notice={props.notice}
            loading={props.loading}
            t={t}
          />
        </TabsContent>

        <TabsContent value='announcements' className='mt-2'>
          <AnnouncementsContent
            announcements={props.announcements}
            loading={props.loading}
            t={t}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
