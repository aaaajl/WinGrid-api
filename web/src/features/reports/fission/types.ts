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

// ============================================================================
// Fission Report Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export type FissionPayoutStatus = 'unpaid' | 'paid' | 'held' | 'skipped'

export type FissionReportRow = {
  inviter_id: number
  username: string
  invitee_count: number
  base_cny: number
  rate: number
  reward_cny: number
  skipped: boolean
  payout_status: FissionPayoutStatus | string
  as_of_date: string
  paid_amount_cny?: number | null
  paid_rate?: number | null
}

export type FissionReportResult = {
  items: FissionReportRow[]
  total: number
  page: number
  page_size: number
  as_of_date: string
  rate: number
}

export type FissionMeta = {
  enabled: boolean
  default_rate: number
  min_payout_cny: number
  timezone: string
  start_period: string
  refreshing: boolean
  as_of_date?: string
  invitee_user_count?: number
  period_stat_rows?: number
  period_eligible_rows?: number
  compliance_confirmed?: boolean
}

export type FissionRefreshSummary = {
  period_month: string
  as_of_date: string
  processed: number
  succeeded: number
  failed: number
  skipped_zero: number
  eligible_invitees: number
  total_eligible_quota: number
  error_samples?: string[]
}

export type FissionInviteeItem = {
  user_id: number
  username: string
  eligible_quota: number
  base_cny: number
  as_of_date: string
}

export type GetFissionReportParams = {
  period_month: string
  rate: number
  page?: number
  page_size?: number
  status?: string
  keyword?: string
}

export type RefreshFissionReportBody = {
  period_month: string
  as_of_date?: string
}

export type MarkFissionPaidBody = {
  period_month: string
  inviter_ids: number[]
  rate: number
  voucher?: string
  remark?: string
}

export type HoldFissionPayoutBody = {
  period_month: string
  inviter_id: number
  hold: boolean
}

export type FissionReportFilters = {
  periodMonth: string
  ratePercent: number
  status: string
  keyword: string
}
