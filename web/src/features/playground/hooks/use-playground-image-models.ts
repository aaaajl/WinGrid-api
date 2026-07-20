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
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getPlaygroundImageModels } from '../api'
import { getOptionLoadErrorMessage } from '../lib'
import { useAuthStore } from '@/stores/auth-store'

export function usePlaygroundImageModels() {
  const { t } = useTranslation()
  const userGroup = useAuthStore((s) => s.auth.user?.group ?? '')

  const { data, error, isError, isLoading } = useQuery({
    queryKey: ['playground-image-models', userGroup],
    queryFn: () => getPlaygroundImageModels(),
  })

  useEffect(() => {
    if (!isError) return
    toast.error(
      getOptionLoadErrorMessage(
        error,
        t('Failed to load playground image models')
      )
    )
  }, [isError, error, t])

  return {
    imageModels: data ?? [],
    isLoadingImageModels: isLoading,
    isImageModelsError: isError,
  }
}
