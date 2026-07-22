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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { markFissionPaid } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { formatCnyAmount, percentToDecimal } from '../lib/reward'
import type { FissionReportRow } from '../types'

type MarkPaidDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodMonth: string
  ratePercent: number
  rows: FissionReportRow[]
  onSuccess: () => void
}

export function MarkPaidDialog(props: MarkPaidDialogProps) {
  const { t } = useTranslation()
  const [voucher, setVoucher] = useState('')
  const [remark, setRemark] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const inviterIds = props.rows.map((row) => row.inviter_id)
  const totalReward = props.rows.reduce(
    (sum, row) => sum + (row.skipped ? 0 : row.reward_cny),
    0
  )

  const handleConfirm = async () => {
    if (inviterIds.length === 0 || props.periodMonth === '') return

    setIsLoading(true)
    try {
      const result = await markFissionPaid({
        period_month: props.periodMonth,
        inviter_ids: inviterIds,
        rate: percentToDecimal(props.ratePercent),
        voucher: voucher.trim() || undefined,
        remark: remark.trim() || undefined,
      })

      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.MARK_PAID_FAILED))
        return
      }

      toast.success(t(SUCCESS_MESSAGES.MARK_PAID))
      props.onSuccess()
      props.onOpenChange(false)
      setVoucher('')
      setRemark('')
    } catch {
      toast.error(t(ERROR_MESSAGES.MARK_PAID_FAILED))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          setVoucher('')
          setRemark('')
        }
        props.onOpenChange(open)
      }}
      title={t('Mark payout as paid')}
      desc={
        inviterIds.length === 1
          ? t(
              'Mark payout for inviter {{id}} ({{amount}}) as paid for {{period}}?',
              {
                id: inviterIds[0],
                amount: formatCnyAmount(totalReward),
                period: props.periodMonth,
              }
            )
          : t(
              'Mark payout for {{count}} inviters ({{amount}} total) as paid for {{period}}?',
              {
                count: inviterIds.length,
                amount: formatCnyAmount(totalReward),
                period: props.periodMonth,
              }
            )
      }
      confirmText={t('Mark paid')}
      handleConfirm={handleConfirm}
      isLoading={isLoading}
    >
      <div className='space-y-3 pt-2'>
        <div className='space-y-1.5'>
          <Label htmlFor='fission-voucher'>{t('Voucher (optional)')}</Label>
          <Input
            id='fission-voucher'
            value={voucher}
            onChange={(event) => setVoucher(event.target.value)}
            placeholder={t('Payment voucher or reference')}
          />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='fission-remark'>{t('Remark (optional)')}</Label>
          <Textarea
            id='fission-remark'
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder={t('Internal remark')}
            rows={3}
          />
        </div>
      </div>
    </ConfirmDialog>
  )
}
