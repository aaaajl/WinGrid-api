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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota } from '@/lib/format'

import { getFissionReportItems } from '../api'
import { ERROR_MESSAGES } from '../constants'
import { formatCnyAmount } from '../lib/reward'
import type { FissionReportRow } from '../types'

type InviteesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodMonth: string
  row: FissionReportRow | null
}

export function InviteesDialog(props: InviteesDialogProps) {
  const { t } = useTranslation()
  const inviterId = props.row?.inviter_id ?? 0

  const { data, isLoading } = useQuery({
    queryKey: ['fission-invitees', props.periodMonth, inviterId],
    enabled: props.open && inviterId > 0 && props.periodMonth !== '',
    queryFn: async () => {
      const result = await getFissionReportItems(props.periodMonth, inviterId)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_INVITEES_FAILED))
        return []
      }
      return result.data ?? []
    },
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] max-w-3xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{t('Invitee details')}</DialogTitle>
          <DialogDescription>
            {props.row
              ? t('Invitees for {{username}} (ID {{id}})', {
                  username: props.row.username || t('Unknown'),
                  id: props.row.inviter_id,
                })
              : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('User ID')}</TableHead>
                <TableHead>{t('Username')}</TableHead>
                <TableHead>{t('Eligible quota')}</TableHead>
                <TableHead>{t('Base (CNY)')}</TableHead>
                <TableHead>{t('As of')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground'>
                    {t('No invitees found for this inviter.')}
                  </TableCell>
                </TableRow>
              ) : (
                (data ?? []).map((item) => (
                  <TableRow key={item.user_id}>
                    <TableCell className='font-mono text-sm'>
                      {item.user_id}
                    </TableCell>
                    <TableCell>{item.username || '-'}</TableCell>
                    <TableCell className='font-mono text-sm'>
                      {formatQuota(item.eligible_quota)}
                    </TableCell>
                    <TableCell className='font-mono text-sm'>
                      {formatCnyAmount(item.base_cny)}
                    </TableCell>
                    <TableCell className='font-mono text-sm'>
                      {item.as_of_date || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
