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
import {
  SPEECH_DRAFT_VERSION,
  STORAGE_KEYS,
  STORAGE_KEYS_IMAGE,
  STORAGE_KEYS_SPEECH,
  STORAGE_KEYS_VIDEO,
} from '../../constants'
import type { ImageFormState } from '../image/build-image-request'
import type { SpeechFormState } from '../speech/build-speech-request'
import type {
  AgnesVideoFormState,
  GenericFormState,
  HappyHorseFormState,
  MiniMaxH3FormState,
  SeedanceFormState,
  Wan30FormState,
} from '../video/build-video-request'

export type PlaygroundTab = 'chat' | 'image' | 'video' | 'speech'

export interface VideoDraft {
  prompt: string
  model: string
  tokenId: string
  happyHorse: HappyHorseFormState | null
  seedance: SeedanceFormState | null
  miniMaxH3: MiniMaxH3FormState | null
  agnesVideo: AgnesVideoFormState | null
  wan30: Wan30FormState | null
  generic: GenericFormState | null
}

export interface ImageDraft {
  model: string
  tokenId: string
  form: ImageFormState | null
}

export interface SpeechDraft {
  model: string
  tokenId: string
  form: SpeechFormState | null
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

export function loadActiveTab(): PlaygroundTab | null {
  const value = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
  if (
    value === 'chat' ||
    value === 'image' ||
    value === 'video' ||
    value === 'speech'
  ) {
    return value
  }
  return null
}

export function saveActiveTab(tab: PlaygroundTab) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab)
  } catch {
    // ignore
  }
}

export function loadVideoDraft(): VideoDraft | null {
  const draft = readJson<VideoDraft>(STORAGE_KEYS_VIDEO.DRAFT)
  if (!draft || typeof draft !== 'object') return null
  return {
    prompt: typeof draft.prompt === 'string' ? draft.prompt : '',
    model: typeof draft.model === 'string' ? draft.model : '',
    tokenId: typeof draft.tokenId === 'string' ? draft.tokenId : '',
    happyHorse: draft.happyHorse ?? null,
    seedance: draft.seedance ?? null,
    miniMaxH3: draft.miniMaxH3 ?? null,
    agnesVideo: draft.agnesVideo ?? null,
    wan30: draft.wan30 ?? null,
    generic: draft.generic ?? null,
  }
}

export function saveVideoDraft(draft: VideoDraft) {
  writeJson(STORAGE_KEYS_VIDEO.DRAFT, draft)
}

export function loadVideoPreviewTaskId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS_VIDEO.PREVIEW_TASK_ID)
  } catch {
    return null
  }
}

export function saveVideoPreviewTaskId(taskId: string | null) {
  try {
    if (!taskId) {
      localStorage.removeItem(STORAGE_KEYS_VIDEO.PREVIEW_TASK_ID)
      return
    }
    localStorage.setItem(STORAGE_KEYS_VIDEO.PREVIEW_TASK_ID, taskId)
  } catch {
    // ignore
  }
}

export function loadImageDraft(): ImageDraft | null {
  const draft = readJson<ImageDraft>(STORAGE_KEYS_IMAGE.DRAFT)
  if (!draft || typeof draft !== 'object') return null
  return {
    model: typeof draft.model === 'string' ? draft.model : '',
    tokenId: typeof draft.tokenId === 'string' ? draft.tokenId : '',
    form: draft.form ?? null,
  }
}

export function saveImageDraft(draft: ImageDraft) {
  writeJson(STORAGE_KEYS_IMAGE.DRAFT, draft)
}

export function loadSpeechDraft(): SpeechDraft | null {
  const draft = readJson<SpeechDraft & { version?: number }>(
    STORAGE_KEYS_SPEECH.DRAFT
  )
  if (!draft || typeof draft !== 'object') return null
  // A draft saved by an older capability contract can hold a voice or format
  // the provider now rejects, so fall back to fresh model defaults.
  if (draft.version !== SPEECH_DRAFT_VERSION) return null
  return {
    model: typeof draft.model === 'string' ? draft.model : '',
    tokenId: typeof draft.tokenId === 'string' ? draft.tokenId : '',
    form: draft.form ?? null,
  }
}

export function saveSpeechDraft(draft: SpeechDraft) {
  writeJson(STORAGE_KEYS_SPEECH.DRAFT, {
    version: SPEECH_DRAFT_VERSION,
    ...draft,
  })
}

export function loadStoredTokenId(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

export function saveStoredTokenId(key: string, tokenId: string) {
  try {
    if (!tokenId) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, tokenId)
  } catch {
    // ignore
  }
}
