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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  API_ENDPOINTS,
  IMAGE_API_ENDPOINTS,
  SPEECH_API_ENDPOINTS,
  VIDEO_API_ENDPOINTS,
} from './constants'
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ModelOption,
  GroupOption,
  TokenOption,
  VideoGenerationRequest,
  VideoTaskResponse,
  PlaygroundVideoModel,
  PlaygroundImageModel,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageRequestProfile,
  PlaygroundSpeechModel,
  SpeechGenerationRequest,
  SpeechRequestProfile,
} from './types'

const IMAGE_PROFILES = new Set<ImageRequestProfile>([
  'dalle2',
  'dalle3',
  'gpt_image',
  'agnes_image',
  'generic',
])

const SPEECH_PROFILES = new Set<SpeechRequestProfile>([
  'openai',
  'qwen',
  'minimax',
  'generic',
])

/**
 * Send chat completion request (non-streaming)
 */
export async function sendChatCompletion(
  payload: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available models
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Get catalog-backed playground video models (t2v tag + profile).
 * Filtered by the authenticated user's usable groups on the server.
 */
export async function getPlaygroundVideoModels(): Promise<
  PlaygroundVideoModel[]
> {
  const res = await api.get(API_ENDPOINTS.PLAYGROUND_VIDEO_MODELS)
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data
    .map((item: Partial<PlaygroundVideoModel>) => ({
      model: item.model ?? '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      groups: Array.isArray(item.groups) ? item.groups : [],
      profile: item.profile,
      label: item.label || item.model || '',
      capabilities: item.capabilities,
    }))
    .filter(
      (item: PlaygroundVideoModel) =>
        !!item.model &&
        (item.profile === 'happyhorse' ||
          item.profile === 'seedance' ||
          item.profile === 'minimax_h3' ||
          item.profile === 'agnes_video' ||
          item.profile === 'wan30_video' ||
          item.profile === 'generic')
    ) as PlaygroundVideoModel[]
}

/**
 * Get catalog-backed playground image models (t2i tag + profile).
 * Filtered by the authenticated user's usable groups on the server.
 */
export async function getPlaygroundImageModels(): Promise<
  PlaygroundImageModel[]
> {
  const res = await api.get(API_ENDPOINTS.PLAYGROUND_IMAGE_MODELS)
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data
    .map((item: Partial<PlaygroundImageModel>) => ({
      model: item.model ?? '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      groups: Array.isArray(item.groups) ? item.groups : [],
      profile: item.profile,
      label: item.label || item.model || '',
      capabilities: item.capabilities,
    }))
    .filter(
      (item: PlaygroundImageModel) =>
        !!item.model &&
        !!item.capabilities &&
        Array.isArray(item.capabilities.supported_sizes) &&
        IMAGE_PROFILES.has(item.profile)
    ) as PlaygroundImageModel[]
}

/**
 * Get catalog-backed playground speech synthesis models (t2a tag + profile).
 * Filtered by the authenticated user's usable groups on the server.
 */
export async function getPlaygroundSpeechModels(): Promise<
  PlaygroundSpeechModel[]
> {
  const res = await api.get(API_ENDPOINTS.PLAYGROUND_SPEECH_MODELS)
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data
    .map((item: Partial<PlaygroundSpeechModel>) => ({
      model: item.model ?? '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      groups: Array.isArray(item.groups) ? item.groups : [],
      profile: item.profile,
      label: item.label || item.model || '',
      capabilities: item.capabilities,
    }))
    .filter(
      (item: PlaygroundSpeechModel) =>
        !!item.model &&
        !!item.capabilities &&
        Array.isArray(item.capabilities.fields) &&
        SPEECH_PROFILES.has(item.profile)
    ) as PlaygroundSpeechModel[]
}

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res
  requireServerSuccess(data)

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  // label is for button display (name only); desc is for dropdown content
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

/**
 * Get user token list (for video API key selector)
 */
export async function getUserTokens(): Promise<TokenOption[]> {
  const res = await api.get('/api/token/?p=1&size=100')
  const { success, data } = res.data
  if (!success || !Array.isArray(data?.items)) return []
  return data.items
    .filter((t: { status: number }) => t.status === 1)
    .map(
      (t: {
        id: number
        name: string
        key: string
        group?: string | null
        auto_groups?: string[] | null
      }) => ({
        id: t.id,
        name: t.name,
        key: t.key,
        group: t.group ?? '',
        autoGroups: Array.isArray(t.auto_groups) ? t.auto_groups : null,
      })
    )
}

export async function getInheritedTokenAutoGroups(): Promise<string[]> {
  const res = await api.get('/api/token/auto-groups')
  const groups = res.data?.data?.groups
  return Array.isArray(groups) ? groups : []
}

/**
 * Fetch real (unmasked) key for a token
 */
export async function fetchTokenKey(id: number): Promise<string | null> {
  const res = await api.post(`/api/token/${id}/key`, undefined, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const { success, data } = res.data
  if (!success || !data?.key) return null
  return data.key as string
}

/**
 * Submit a video generation task
 */
export async function submitVideoGeneration(
  payload: VideoGenerationRequest,
  apiKey: string
): Promise<VideoTaskResponse> {
  try {
    const res = await api.post(VIDEO_API_ENDPOINTS.SUBMIT, payload, {
      skipErrorHandler: true,
      skipBusinessError: true,
      skipAuthRefresh: true,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    } as Record<string, unknown>)
    return res.data
  } catch (err) {
    const axiosErr = err as {
      response?: {
        data?: {
          message?: string
          Message?: string
          error?: { message?: string }
        }
      }
      message?: string
    }
    const data = axiosErr.response?.data
    const message =
      data?.error?.message ||
      data?.message ||
      data?.Message ||
      axiosErr.message ||
      'Request failed'
    throw new Error(message)
  }
}

/**
 * Fetch video task status by task ID
 */
export async function fetchVideoTaskStatus(
  taskId: string,
  apiKey: string
): Promise<VideoTaskResponse> {
  const res = await api.get(VIDEO_API_ENDPOINTS.STATUS(taskId), {
    skipErrorHandler: true,
    skipBusinessError: true,
    skipAuthRefresh: true,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  } as Record<string, unknown>)
  return res.data
}

/**
 * Submit an OpenAI-compatible image generation request
 */
export async function submitImageGeneration(
  payload: ImageGenerationRequest,
  apiKey: string
): Promise<ImageGenerationResponse> {
  try {
    const res = await api.post(IMAGE_API_ENDPOINTS.GENERATIONS, payload, {
      skipErrorHandler: true,
      skipBusinessError: true,
      skipAuthRefresh: true,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    } as Record<string, unknown>)
    return res.data
  } catch (err) {
    const axiosErr = err as {
      response?: {
        data?: ImageGenerationResponse & {
          message?: string
          error?: { message?: string }
        }
      }
      message?: string
    }
    const data = axiosErr.response?.data
    const message =
      data?.error?.message ||
      data?.message ||
      axiosErr.message ||
      'Request failed'
    return {
      created: 0,
      data: [],
      error: { message },
    }
  }
}

/**
 * Submit an OpenAI-compatible speech synthesis request.
 * The relay returns binary audio, so the response is read as a Blob.
 */
export async function submitSpeechGeneration(
  payload: SpeechGenerationRequest,
  apiKey: string
): Promise<{ blob: Blob; contentType: string }> {
  try {
    const res = await api.post(SPEECH_API_ENDPOINTS.GENERATIONS, payload, {
      skipErrorHandler: true,
      skipBusinessError: true,
      skipAuthRefresh: true,
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    } as Record<string, unknown>)
    const contentType = String(res.headers?.['content-type'] ?? 'audio/mpeg')
    return { blob: res.data as Blob, contentType }
  } catch (err) {
    const axiosErr = err as {
      response?: { data?: unknown }
      message?: string
    }
    let message = axiosErr.message || 'Request failed'
    const data = axiosErr.response?.data
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as {
          error?: { message?: string }
          message?: string
        }
        message = parsed.error?.message || parsed.message || message
      } catch {
        // Non-JSON error body; keep the transport message.
      }
    }
    throw new Error(message)
  }
}
