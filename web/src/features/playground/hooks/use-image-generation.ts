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
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { t } from 'i18next'

import { submitImageGeneration } from '../api'
import { IMAGE_HISTORY_MAX, STORAGE_KEYS_IMAGE } from '../constants'
import type {
  ImageGenerationRequest,
  ImageHistoryItem,
  ImageRequestProfile,
} from '../types'

function loadHistoryFromStorage(): ImageHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS_IMAGE.HISTORY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ImageHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({
      ...item,
      images: Array.isArray(item.images)
        ? item.images.map((img, index) => ({
            ...img,
            id: img.id || `${item.id}_${index}`,
          }))
        : [],
    }))
  } catch {
    return []
  }
}

function saveHistoryToStorage(items: ImageHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS_IMAGE.HISTORY, JSON.stringify(items))
  } catch {
    // ignore storage errors (e.g. quota)
  }
}

function createHistoryId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useImageGeneration() {
  const [history, setHistory] = useState<ImageHistoryItem[]>(() =>
    loadHistoryFromStorage()
  )
  const [previewItem, setPreviewItem] = useState<ImageHistoryItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    saveHistoryToStorage(history)
  }, [history])

  const generate = useCallback(
    async (
      req: ImageGenerationRequest,
      apiKey: string,
      meta?: { profile?: ImageRequestProfile }
    ) => {
      setIsSubmitting(true)
      setSubmitError(null)
      try {
        const res = await submitImageGeneration(req, apiKey)
        if (res.error?.message) {
          throw new Error(res.error.message)
        }
        const images = Array.isArray(res.data) ? res.data : []
        if (images.length === 0) {
          throw new Error(t('No images returned from server'))
        }

        const item: ImageHistoryItem = {
          id: createHistoryId(),
          model: req.model,
          prompt: req.prompt,
          n: req.n ?? images.length,
          createdAt: res.created ?? Math.floor(Date.now() / 1000),
          images: images.map((img, index) => ({
            id: `${createHistoryId()}_${index}`,
            ...(img.url ? { url: img.url } : {}),
            ...(img.b64_json ? { b64_json: img.b64_json } : {}),
            ...(img.revised_prompt
              ? { revised_prompt: img.revised_prompt }
              : {}),
          })),
          ...(req.size ? { size: req.size } : {}),
          ...(meta?.profile ? { profile: meta.profile } : {}),
        }

        setHistory((prev) => [item, ...prev].slice(0, IMAGE_HISTORY_MAX))
        setPreviewItem(item)
        toast.success(t('Image generation completed'))
        return item
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('Submission failed')
        setSubmitError(msg)
        throw err
      } finally {
        setIsSubmitting(false)
      }
    },
    []
  )

  const removeHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
    setPreviewItem((current) => (current?.id === id ? null : current))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    setPreviewItem(null)
  }, [])

  return {
    history,
    previewItem,
    setPreviewItem,
    isSubmitting,
    submitError,
    generate,
    removeHistoryItem,
    clearHistory,
  }
}
