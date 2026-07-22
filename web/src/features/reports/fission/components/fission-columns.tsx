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
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  FISSION_PAYOUT_STATUS,
  FISSION_PAYOUT_STATUSES,
} from '../constants'
import { formatCnyAmount } from '../lib/reward'
import type { FissionReportRow } from '../types'

type FissionColumnHandlers = {
  onViewInvitees: (row: FissionReportRow) => void
  onMarkPaid: (row: FissionReportRow) => void
}

export function useFissionColumns(
  handlers: FissionColumnHandlers
): ColumnDef<FissionReportRow>[] {
  const { t } = useTranslation()

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
          disabled={!canMarkPaid(row.original)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: 'inviter_id',
      header: t('Inviter ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TableId
          value={row.getValue('inviter_id') as number}
          className='w-[60px]'
        />
      ),
      size: 90,
    },
    {
      accessorKey: 'username',
      header: t('Username'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('username') || '-'}</span>
      ),
      size: 160,
    },
    {
      accessorKey: 'invitee_count',
      header: t('Invitees'),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.getValue('invitee_count')}</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'base_cny',
      header: t('Base (CNY)'),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatCnyAmount(row.getValue('base_cny') as number)}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'reward_cny',
      header: t('Reward (CNY)'),
      cell: ({ row }) => {
        const rowData = row.original
        return (
          <span
            className={`font-mono text-sm ${rowData.skipped ? 'text-muted-foreground' : ''}`}
          >
            {rowData.skipped
              ? t('Skipped')
              : formatCnyAmount(row.getValue('reward_cny') as number)}
          </span>
        )
      },
      size: 120,
    },
    {
      accessorKey: 'skipped',
      header: t('Skipped'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <StatusBadge
          label={row.getValue('skipped') ? t('Yes') : t('No')}
          variant={row.getValue('skipped') ? 'neutral' : 'success'}
          copyable={false}
          className='-ml-1.5'
        />
      ),
      size: 90,
    },
    {
      accessorKey: 'payout_status',
      header: t('Payout Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const rowData = row.original
        const status =
          rowData.skipped &&
          rowData.payout_status === FISSION_PAYOUT_STATUS.UNPAID
            ? FISSION_PAYOUT_STATUS.SKIPPED
            : String(rowData.payout_status)
        const config = FISSION_PAYOUT_STATUSES[status]

        if (!config) {
          return (
            <StatusBadge
              label={status}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }

        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 120,
    },
    {
      accessorKey: 'as_of_date',
      header: t('As of'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {(row.getValue('as_of_date') as string) || '-'}
        </span>
      ),
      size: 120,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => {
        const rowData = row.original
        const markPaidDisabled = !canMarkPaid(rowData)

        return (
          <div className='-ml-1.5 flex items-center gap-1'>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => handlers.onViewInvitees(rowData)}
                    aria-label={t('View invitees')}
                  />
                }
              >
                <Eye />
              </TooltipTrigger>
              <TooltipContent>{t('View invitees')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => handlers.onMarkPaid(rowData)}
                    disabled={markPaidDisabled}
                    aria-label={t('Mark paid')}
                  />
                }
              >
                <Wallet />
              </TooltipTrigger>
              <TooltipContent>{t('Mark paid')}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
      meta: { pinned: 'right' as const },
      size: 100,
    },
  ]
}

function canMarkPaid(row: FissionReportRow): boolean {
  return (
    !row.skipped &&
    row.payout_status !== FISSION_PAYOUT_STATUS.PAID &&
    row.reward_cny > 0
  )
}

export { canMarkPaid }
