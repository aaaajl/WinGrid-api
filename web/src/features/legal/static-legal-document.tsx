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

import { PublicLayout } from '@/components/layout'
import { RichContent } from '@/components/rich-content'

type StaticLegalDocumentProps = {
  titleKey: string
  getContent: (language: string) => string
}

export function StaticLegalDocument(props: StaticLegalDocumentProps) {
  const { t, i18n } = useTranslation()
  const content = props.getContent(i18n.resolvedLanguage || i18n.language)

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl space-y-6 py-12'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>
            {t(props.titleKey)}
          </h1>
        </div>

        <RichContent
          mode='markdown'
          content={content}
          className='prose-neutral dark:prose-invert max-w-none'
        />
      </div>
    </PublicLayout>
  )
}
