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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface TermsFooterProps {
  variant?: 'sign-in' | 'sign-up'
  className?: string
  status?: SystemStatus | null
}

export function TermsFooter({
  variant = 'sign-in',
  className,
}: TermsFooterProps) {
  const { t } = useTranslation()
  const text =
    variant === 'sign-in'
      ? t('By clicking sign in, you agree to our')
      : t('By creating an account, you agree to our')

  const activeLinks: Array<{ label: string; href: string }> = [
    {
      label: t('User Agreement'),
      href: '/user-agreement',
    },
    {
      label: t('Privacy Policy'),
      href: '/privacy-policy',
    },
    {
      label: t('AUP'),
      href: '/aup',
    },
  ]

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      {text}{' '}
      {activeLinks.map((link, index) => {
        let separator: string | null = null
        if (index > 0) {
          separator =
            index === activeLinks.length - 1 ? ` ${t('and')} ` : ', '
        }
        return (
          <span key={link.href}>
            {separator}
            <a
              href={link.href}
              className='hover:text-primary underline underline-offset-4'
            >
              {link.label}
            </a>
          </span>
        )
      })}
      .
    </p>
  )
}
