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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getFissionMeta, getFissionReport } from '../api'
import {
  DEFAULT_MIN_PAYOUT_CNY,
  DEFAULT_PAGE_SIZE,
  DEFAULT_RATE_PERCENT,
  ERROR_MESSAGES,
} from '../constants'
import { applyRatePreview, percentToDecimal } from '../lib/reward'
import type { FissionReportFilters, FissionReportRow } from '../types'
import { canMarkPaid, useFissionColumns } from './fission-columns'
import { FissionBulkActions } from './fission-bulk-actions'
import { FissionFilters } from './fission-filters'
import { InviteesDialog } from './invitees-dialog'
import { MarkPaidDialog } from './mark-paid-dialog'

const route = getRouteApi('/_authenticated/reports/fission')

function resolveAppliedFilters(search: {
  periodMonth?: string
  rate?: number
  status?: string
  keyword?: string
}): FissionReportFilters {
  return {
    periodMonth: search.periodMonth || dayjs().format('YYYY-MM'),
    ratePercent: search.rate ?? DEFAULT_RATE_PERCENT,
    status: search.status ?? '',
    keyword: search.keyword ?? '',
  }
}

type FissionTableProps = {
  onAsOfDateChange?: (asOfDate: string) => void
}

export function FissionTable(props: FissionTableProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const appliedFilters = useMemo(
    () => resolveAppliedFilters(search),
    [search.periodMonth, search.rate, search.status, search.keyword]
  )

  const [draftFilters, setDraftFilters] =
    useState<FissionReportFilters>(appliedFilters)

  useEffect(() => {
    setDraftFilters(appliedFilters)
  }, [appliedFilters])

  const [inviteesRow, setInviteesRow] = useState<FissionReportRow | null>(null)
  const [markPaidRows, setMarkPaidRows] = useState<FissionReportRow[]>([])
  const [markPaidOpen, setMarkPaidOpen] = useState(false)

  const {
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: DEFAULT_PAGE_SIZE },
  })

  const { data: metaData } = useQuery({
    queryKey: ['fission-meta', appliedFilters.periodMonth],
    queryFn: async () => {
      const result = await getFissionMeta(appliedFilters.periodMonth)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_META_FAILED))
        return null
      }
      return result.data ?? null
    },
  })

  const minPayoutCny = metaData?.min_payout_cny ?? DEFAULT_MIN_PAYOUT_CNY

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      'fission-report',
      appliedFilters.periodMonth,
      appliedFilters.ratePercent,
      appliedFilters.status,
      appliedFilters.keyword,
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      if (!appliedFilters.periodMonth) {
        return { items: [], total: 0, as_of_date: '' }
      }

      const result = await getFissionReport({
        period_month: appliedFilters.periodMonth,
        rate: percentToDecimal(appliedFilters.ratePercent),
        page: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: appliedFilters.status || undefined,
        keyword: appliedFilters.keyword.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_REPORT_FAILED))
        return { items: [], total: 0, as_of_date: '' }
      }

      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
        as_of_date: result.data?.as_of_date ?? metaData?.as_of_date ?? '',
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const asOfDate =
    data?.as_of_date || metaData?.as_of_date || appliedFilters.periodMonth

  useEffect(() => {
    props.onAsOfDateChange?.(asOfDate)
  }, [asOfDate, props.onAsOfDateChange])

  const displayRows = useMemo(() => {
    const items = data?.items ?? []
    if (draftFilters.ratePercent === appliedFilters.ratePercent) {
      return items
    }
    return applyRatePreview(items, draftFilters.ratePercent, minPayoutCny)
  }, [
    appliedFilters.ratePercent,
    data?.items,
    draftFilters.ratePercent,
    minPayoutCny,
  ])

  const openMarkPaid = useCallback((rows: FissionReportRow[]) => {
    const eligible = rows.filter(canMarkPaid)
    if (eligible.length === 0) return
    setMarkPaidRows(eligible)
    setMarkPaidOpen(true)
  }, [])

  const columns = useFissionColumns({
    onViewInvitees: (row) => setInviteesRow(row),
    onMarkPaid: (row) => openMarkPaid([row]),
  })

  const { table } = useDataTable({
    data: displayRows,
    columns,
    enableRowSelection: (row) => canMarkPaid(row.original),
    pagination,
    onPaginationChange,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
    getRowId: (row) => String(row.inviter_id),
  })

  const handleQuery = () => {
    if (!draftFilters.periodMonth) {
      toast.error(t(ERROR_MESSAGES.INVALID_PERIOD))
      return
    }
    if (draftFilters.ratePercent <= 0) {
      toast.error(t(ERROR_MESSAGES.INVALID_RATE))
      return
    }

    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        periodMonth: draftFilters.periodMonth,
        rate: draftFilters.ratePercent,
        status: draftFilters.status || undefined,
        keyword: draftFilters.keyword.trim() || undefined,
        page: 1,
        pageSize: pagination.pageSize,
      }),
    })
  }

  const handleMarkPaidSuccess = () => {
    table.resetRowSelection()
    void queryClient.invalidateQueries({ queryKey: ['fission-report'] })
    void refetch()
  }

  return (
    <>
      <div className='flex h-full min-h-0 flex-col gap-3'>
        <FissionFilters
          draft={draftFilters}
          onDraftChange={setDraftFilters}
          onQuery={handleQuery}
          isFetching={isFetching}
        />

        <div className='min-h-0 flex-1'>
          <DataTablePage
            table={table}
            columns={columns}
            isLoading={isLoading}
            isFetching={isFetching}
            emptyTitle={t('No fission report rows found')}
            emptyDescription={t(
              'Try another period, rate, or filter combination.'
            )}
            skeletonKeyPrefix='fission-report'
            applyHeaderSize
            toolbarProps={null}
            bulkActions={
              <FissionBulkActions
                table={table}
                onMarkPaid={openMarkPaid}
              />
            }
          />
        </div>
      </div>

      <InviteesDialog
        open={inviteesRow != null}
        onOpenChange={(open) => {
          if (!open) setInviteesRow(null)
        }}
        periodMonth={appliedFilters.periodMonth}
        row={inviteesRow}
      />

      <MarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        periodMonth={appliedFilters.periodMonth}
        ratePercent={draftFilters.ratePercent}
        rows={markPaidRows}
        onSuccess={handleMarkPaidSuccess}
      />
    </>
  )
}
