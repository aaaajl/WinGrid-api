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
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

import type { FissionPayoutStatus } from './types'

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_RATE_PERCENT = 3
export const DEFAULT_MIN_PAYOUT_CNY = 10
export const DEFAULT_PAGE_SIZE = 20

export const FISSION_PAYOUT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  HELD: 'held',
  SKIPPED: 'skipped',
} as const satisfies Record<string, FissionPayoutStatus>

export const FISSION_PAYOUT_STATUSES: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  [FISSION_PAYOUT_STATUS.UNPAID]: {
    labelKey: 'Unpaid',
    variant: 'warning',
  },
  [FISSION_PAYOUT_STATUS.PAID]: {
    labelKey: 'Paid',
    variant: 'success',
  },
  [FISSION_PAYOUT_STATUS.HELD]: {
    labelKey: 'Held',
    variant: 'neutral',
  },
  [FISSION_PAYOUT_STATUS.SKIPPED]: {
    labelKey: 'Skipped',
    variant: 'neutral',
  },
}

export const FISSION_STATUS_FILTER_ALL = '__all__'

export function getFissionStatusOptions(t: TFunction) {
  return [
    { label: t('All statuses'), value: FISSION_STATUS_FILTER_ALL },
    {
      label: t(FISSION_PAYOUT_STATUSES.unpaid.labelKey),
      value: FISSION_PAYOUT_STATUS.UNPAID,
    },
    {
      label: t(FISSION_PAYOUT_STATUSES.paid.labelKey),
      value: FISSION_PAYOUT_STATUS.PAID,
    },
    {
      label: t(FISSION_PAYOUT_STATUSES.held.labelKey),
      value: FISSION_PAYOUT_STATUS.HELD,
    },
    {
      label: t(FISSION_PAYOUT_STATUSES.skipped.labelKey),
      value: FISSION_PAYOUT_STATUS.SKIPPED,
    },
  ]
}

// ============================================================================
// Messages
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_META_FAILED: 'Failed to load fission report metadata',
  LOAD_REPORT_FAILED: 'Failed to load fission report',
  LOAD_INVITEES_FAILED: 'Failed to load invitee details',
  EXPORT_FAILED: 'Failed to export fission report',
  REFRESH_FAILED: 'Failed to recalculate fission report',
  MARK_PAID_FAILED: 'Failed to mark payout as paid',
  HOLD_FAILED: 'Failed to update payout hold status',
  INVALID_RATE: 'Rate must be greater than 0',
  INVALID_PERIOD: 'Please select a valid period month',
} as const

export const SUCCESS_MESSAGES = {
  EXPORT_STARTED: 'Fission report exported successfully',
  REFRESH_COMPLETED: 'Fission report recalculation completed',
  MARK_PAID: 'Payout marked as paid successfully',
  HOLD_UPDATED: 'Payout hold status updated',
} as const
