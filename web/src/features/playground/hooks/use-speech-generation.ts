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
import { t } from 'i18next'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { submitSpeechGeneration } from '../api'
import { SPEECH_HISTORY_MAX, STORAGE_KEYS_SPEECH } from '../constants'
import type {
  SpeechGenerationRequest,
  SpeechHistoryItem,
  SpeechRequestProfile,
} from '../types'

function loadHistoryFromStorage(): SpeechHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS_SPEECH.HISTORY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SpeechHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) =>
        !!item && typeof item.audioDataUrl === 'string' && item.audioDataUrl
    )
  } catch {
    return []
  }
}

function saveHistoryToStorage(items: SpeechHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS_SPEECH.HISTORY, JSON.stringify(items))
  } catch {
    // ignore storage errors (large clips can exceed the quota)
  }
}

function createHistoryId() {
  return `speech_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () =>
      reject(new Error('Failed to read audio data'))
    )
    reader.readAsDataURL(blob)
  })
}

export function useSpeechGeneration() {
  const [history, setHistory] = useState<SpeechHistoryItem[]>(() =>
    loadHistoryFromStorage()
  )
  const [previewItem, setPreviewItem] = useState<SpeechHistoryItem | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isSubmitting = pendingCount > 0

  useEffect(() => {
    saveHistoryToStorage(history)
  }, [history])

  const generate = useCallback(
    async (
      req: SpeechGenerationRequest,
      apiKey: string,
      meta?: { profile?: SpeechRequestProfile }
    ) => {
      setPendingCount((count) => count + 1)
      setSubmitError(null)
      try {
        const { blob, contentType } = await submitSpeechGeneration(req, apiKey)
        if (blob.size === 0) {
          throw new Error(t('No audio returned from server'))
        }
        const audioDataUrl = await blobToDataUrl(blob)

        const item: SpeechHistoryItem = {
          id: createHistoryId(),
          model: req.model,
          input: req.input,
          voice: req.voice ?? '',
          responseFormat: req.response_format ?? '',
          createdAt: Math.floor(Date.now() / 1000),
          audioDataUrl,
          mimeType: contentType,
          ...(meta?.profile ? { profile: meta.profile } : {}),
        }

        setHistory((prev) => [item, ...prev].slice(0, SPEECH_HISTORY_MAX))
        setPreviewItem(item)
        toast.success(t('Speech synthesis completed'))
        return item
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('Submission failed')
        setSubmitError(msg)
        throw err
      } finally {
        setPendingCount((count) => Math.max(0, count - 1))
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
