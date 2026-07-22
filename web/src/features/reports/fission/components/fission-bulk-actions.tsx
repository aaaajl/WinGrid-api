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
import type { Table } from '@tanstack/react-table'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Button } from '@/components/ui/button'

import type { FissionReportRow } from '../types'

type FissionBulkActionsProps = {
  table: Table<FissionReportRow>
  onMarkPaid: (rows: FissionReportRow[]) => void
}

export function FissionBulkActions(props: FissionBulkActionsProps) {
  const { t } = useTranslation()
  const selectedRows = props.table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)

  if (selectedRows.length === 0) {
    return null
  }

  return (
    <BulkActionsToolbar table={props.table} entityName={t('inviter')}>
      <Button
        variant='outline'
        size='sm'
        className='h-8'
        onClick={() => props.onMarkPaid(selectedRows)}
      >
        <Wallet className='mr-1.5 size-4' />
        {t('Mark paid')}
      </Button>
    </BulkActionsToolbar>
  )
}
