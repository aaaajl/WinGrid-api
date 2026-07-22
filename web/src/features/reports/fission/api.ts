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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  FissionInviteeItem,
  FissionMeta,
  FissionRefreshSummary,
  FissionReportResult,
  GetFissionReportParams,
  HoldFissionPayoutBody,
  MarkFissionPaidBody,
  RefreshFissionReportBody,
} from './types'

function buildReportQuery(params: GetFissionReportParams) {
  const query = new URLSearchParams()
  query.set('period_month', params.period_month)
  query.set('rate', String(params.rate))
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.page_size ?? 20))
  if (params.status) query.set('status', params.status)
  if (params.keyword) query.set('keyword', params.keyword)
  return query.toString()
}

export async function getFissionMeta(
  periodMonth?: string
): Promise<ApiResponse<FissionMeta>> {
  const query = periodMonth
    ? `?period_month=${encodeURIComponent(periodMonth)}`
    : ''
  const res = await api.get(`/api/fission/meta${query}`)
  return res.data
}

export async function getFissionReport(
  params: GetFissionReportParams
): Promise<ApiResponse<FissionReportResult>> {
  const res = await api.get(`/api/fission/report?${buildReportQuery(params)}`)
  return res.data
}

export async function getFissionReportItems(
  periodMonth: string,
  inviterId: number
): Promise<ApiResponse<FissionInviteeItem[]>> {
  const query = new URLSearchParams()
  query.set('period_month', periodMonth)
  query.set('inviter_id', String(inviterId))
  const res = await api.get(`/api/fission/report/items?${query.toString()}`)
  return res.data
}

export async function exportFissionReport(params: {
  period_month: string
  rate: number
  status?: string
  keyword?: string
}): Promise<void> {
  const query = new URLSearchParams()
  query.set('period_month', params.period_month)
  query.set('rate', String(params.rate))
  if (params.status) query.set('status', params.status)
  if (params.keyword) query.set('keyword', params.keyword)

  const res = await api.get(`/api/fission/report/export?${query.toString()}`, {
    responseType: 'blob',
    skipBusinessError: true,
    skipErrorHandler: true,
  })

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `fission-report-${params.period_month}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function refreshFissionReport(
  body: RefreshFissionReportBody
): Promise<ApiResponse<FissionRefreshSummary>> {
  const res = await api.post('/api/fission/refresh', body, {
    // Manual refresh runs synchronously and can take minutes with many invitees.
    timeout: 10 * 60 * 1000,
  })
  return res.data
}

export async function markFissionPaid(
  body: MarkFissionPaidBody
): Promise<ApiResponse<{ marked: number }>> {
  const res = await api.post('/api/fission/payout/mark_paid', body)
  return res.data
}

export async function holdFissionPayout(
  body: HoldFissionPayoutBody
): Promise<ApiResponse> {
  const res = await api.post('/api/fission/payout/hold', body)
  return res.data
}
