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
import { Download, RefreshCw } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { exportFissionReport, getFissionMeta, refreshFissionReport } from './api'
import { FissionTable } from './components/fission-table'
import {
  DEFAULT_RATE_PERCENT,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from './constants'
import { percentToDecimal } from './lib/reward'

const route = getRouteApi('/_authenticated/reports/fission')

export function FissionReport() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const routeSearch = route.useSearch()

  const [asOfDate, setAsOfDate] = useState('')
  const [recalculateOpen, setRecalculateOpen] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const appliedPeriodMonth =
    routeSearch.periodMonth || dayjs().format('YYYY-MM')
  const appliedRatePercent = routeSearch.rate ?? DEFAULT_RATE_PERCENT

  const { data: metaData, refetch: refetchMeta } = useQuery({
    queryKey: ['fission-meta', appliedPeriodMonth],
    queryFn: async () => {
      const result = await getFissionMeta(appliedPeriodMonth)
      if (!result.success) return null
      return result.data ?? null
    },
  })

  const invalidateReport = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['fission-report'] })
    void queryClient.invalidateQueries({ queryKey: ['fission-meta'] })
    void refetchMeta()
  }, [queryClient, refetchMeta])

  const handleRecalculate = async () => {
    if (!appliedPeriodMonth) {
      toast.error(t(ERROR_MESSAGES.INVALID_PERIOD))
      return
    }

    setIsRecalculating(true)
    try {
      const result = await refreshFissionReport({
        period_month: appliedPeriodMonth,
      })

      if (!result.success || !result.data) {
        toast.error(result.message || t(ERROR_MESSAGES.REFRESH_FAILED))
        return
      }

      const summary = result.data
      if (summary.failed > 0) {
        toast.warning(
          t(
            'Fission recalculation finished with errors: {{failed}} failed, {{eligible}} eligible invitees (processed {{processed}})',
            {
              failed: summary.failed,
              eligible: summary.eligible_invitees,
              processed: summary.processed,
            }
          )
        )
      } else if (summary.eligible_invitees === 0) {
        toast.info(
          t(
            'Fission recalculation completed with no eligible usage: processed {{processed}} invitees (as of {{asOf}})',
            {
              processed: summary.processed,
              asOf: summary.as_of_date,
            }
          )
        )
      } else {
        toast.success(
          t(
            'Fission report recalculation completed ({{count}} invitees with eligible usage)',
            { count: summary.eligible_invitees }
          )
        )
      }
      invalidateReport()
    } catch {
      toast.error(t(ERROR_MESSAGES.REFRESH_FAILED))
    } finally {
      setIsRecalculating(false)
      setRecalculateOpen(false)
    }
  }

  const handleExport = async () => {
    if (!appliedPeriodMonth) {
      toast.error(t(ERROR_MESSAGES.INVALID_PERIOD))
      return
    }

    setIsExporting(true)
    try {
      await exportFissionReport({
        period_month: appliedPeriodMonth,
        rate: percentToDecimal(appliedRatePercent),
        status: routeSearch.status || undefined,
        keyword: routeSearch.keyword?.trim() || undefined,
      })
      toast.success(t(SUCCESS_MESSAGES.EXPORT_STARTED))
    } catch {
      toast.error(t(ERROR_MESSAGES.EXPORT_FAILED))
    } finally {
      setIsExporting(false)
    }
  }

  const isRefreshing = Boolean(metaData?.refreshing || isRecalculating)

  const updatedLabel = useMemo(() => {
    if (!asOfDate) return ''
    return t('Updated as of {{date}}', { date: asOfDate })
  }, [asOfDate, t])

  const diagnosticLabel = useMemo(() => {
    if (!metaData) return ''
    const invitees = metaData.invitee_user_count ?? 0
    const eligible = metaData.period_eligible_rows ?? 0
    return t(
      'Invitees: {{invitees}} · Eligible rows: {{eligible}}',
      { invitees, eligible }
    )
  }, [metaData, t])

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Fission Report')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            {diagnosticLabel ? (
              <span className='text-muted-foreground text-xs sm:text-sm'>
                {diagnosticLabel}
              </span>
            ) : null}
            {updatedLabel ? (
              <span className='text-muted-foreground text-xs sm:text-sm'>
                {updatedLabel}
              </span>
            ) : null}
            <Button
              variant='outline'
              size='sm'
              onClick={() => setRecalculateOpen(true)}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`mr-1.5 size-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              {t('Recalculate')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className='mr-1.5 size-4' />
              {t('Export')}
            </Button>
          </div>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <FissionTable onAsOfDateChange={setAsOfDate} />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ConfirmDialog
        open={recalculateOpen}
        onOpenChange={setRecalculateOpen}
        title={t('Recalculate')}
        desc={t(
          'Recalculate fission stats for {{period}}? This may take a while.',
          { period: appliedPeriodMonth }
        )}
        confirmText={t('Recalculate')}
        handleConfirm={handleRecalculate}
        isLoading={isRecalculating}
      />
    </>
  )
}
