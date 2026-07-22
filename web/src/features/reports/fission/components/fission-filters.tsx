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
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getFissionStatusOptions, FISSION_STATUS_FILTER_ALL } from '../constants'
import type { FissionReportFilters } from '../types'

type FissionFiltersProps = {
  draft: FissionReportFilters
  onDraftChange: (next: FissionReportFilters) => void
  onQuery: () => void
  isFetching?: boolean
}

export function FissionFilters(props: FissionFiltersProps) {
  const { t } = useTranslation()
  const statusOptions = getFissionStatusOptions(t)

  return (
    <div className='bg-card shrink-0 rounded-xl border p-3 sm:p-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end'>
        <div className='space-y-1.5'>
          <Label htmlFor='fission-period-month'>{t('Period month')}</Label>
          <Input
            id='fission-period-month'
            type='month'
            value={props.draft.periodMonth}
            onChange={(event) =>
              props.onDraftChange({
                ...props.draft,
                periodMonth: event.target.value,
              })
            }
          />
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='fission-rate'>{t('Rate (%)')}</Label>
          <Input
            id='fission-rate'
            type='number'
            min={0.01}
            step={0.01}
            value={props.draft.ratePercent}
            onChange={(event) => {
              const value = Number(event.target.value)
              props.onDraftChange({
                ...props.draft,
                ratePercent: Number.isFinite(value) ? value : 0,
              })
            }}
          />
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='fission-status'>{t('Status')}</Label>
          <Select
            value={props.draft.status || FISSION_STATUS_FILTER_ALL}
            onValueChange={(value) =>
              props.onDraftChange({
                ...props.draft,
                status:
                  value === FISSION_STATUS_FILTER_ALL ? '' : (value ?? ''),
              })
            }
          >
            <SelectTrigger id='fission-status' className='w-full'>
              <SelectValue placeholder={t('All statuses')} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='fission-keyword'>{t('Keyword')}</Label>
          <Input
            id='fission-keyword'
            value={props.draft.keyword}
            placeholder={t('Username or inviter ID')}
            onChange={(event) =>
              props.onDraftChange({
                ...props.draft,
                keyword: event.target.value,
              })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                props.onQuery()
              }
            }}
          />
        </div>

        <div className='flex items-end'>
          <Button
            className='w-full'
            onClick={props.onQuery}
            disabled={props.isFetching}
          >
            <Search className='mr-1.5 size-4' />
            {t('Query')}
          </Button>
        </div>
      </div>
    </div>
  )
}
