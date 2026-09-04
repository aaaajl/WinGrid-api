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
// Message types
export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'loading' | 'streaming' | 'complete' | 'error'

export type PlaygroundMessageLayoutMode = 'alternating' | 'left'

export interface MessageVersion {
  id: string
  content: string
}

export interface Message {
  key: string
  from: MessageRole
  versions: MessageVersion[]
  createdAt?: number
  startedAt?: number
  completedAt?: number
  durationMs?: number
  sources?: { href: string; title: string }[]
  reasoning?: {
    content: string
    duration: number
    startedAt?: number
    completedAt?: number
    durationMs?: number
  }
  isReasoningStreaming?: boolean
  isReasoningComplete?: boolean
  isContentComplete?: boolean
  status?: MessageStatus
  errorCode?: string | null
}

// API payload types
export interface ChatCompletionMessage {
  role: MessageRole
  content: string | ContentPart[]
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface ChatCompletionRequest {
  model: string
  group?: string
  messages: ChatCompletionMessage[]
  stream: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: MessageRole
      content?: string
      reasoning_content?: string
    }
    finish_reason: string | null
  }>
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: MessageRole
      content: string
      reasoning_content?: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Configuration types
export interface PlaygroundConfig {
  model: string
  group: string
  temperature: number
  top_p: number
  max_tokens: number
  frequency_penalty: number
  presence_penalty: number
  seed: number | null
  stream: boolean
}

export interface ParameterEnabled {
  temperature: boolean
  top_p: boolean
  max_tokens: boolean
  frequency_penalty: boolean
  presence_penalty: boolean
  seed: boolean
}

// Model and group options
export interface ModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

// ========== Video generation types ==========

export type VideoTaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

export interface TokenOption {
  id: number
  name: string
  key: string
  group: string
  autoGroups: string[] | null
}

export interface VideoGenerationRequest {
  model: string
  /** Kept for task queue display; MiniMax-H3 adaptor ignores unknown fields. */
  prompt?: string
  size?: string
  /** HappyHorse / DashScope-style resolution (alias of size on the gateway). */
  resolution?: string
  duration?: number
  ratio?: string
  aigc_watermark?: boolean
  /** Optional image-to-video reference (Agnes / TaskSubmitReq). */
  image?: string
  content?: Array<{
    type: 'text' | 'image_url' | 'video_url' | 'audio_url'
    text?: string
    image_url?: { url: string }
    video_url?: { url: string }
    audio_url?: { url: string }
    role?: string
  }>
  images?: string[]
  input_reference?: string
  metadata?: Record<string, unknown>
}

export type VideoRequestProfile =
  | 'happyhorse'
  | 'seedance'
  | 'minimax_h3'
  | 'agnes_video'
  | 'wan30_video'
  | 'generic'

export interface HappyHorseCapabilities {
  supported_sizes: string[]
  duration_range: [number, number]
  fields: string[]
}

export interface SeedanceCapabilities {
  supported_resolutions: string[]
  supported_ratios: string[]
  duration_range: [number, number]
  fields: string[]
}

export interface MiniMaxH3Capabilities {
  supported_resolutions: string[]
  supported_ratios: string[]
  duration_range: [number, number]
  fields: string[]
  form: 'minimax_h3'
}

export interface AgnesVideoCapabilities {
  supported_sizes: string[]
  supported_ratios: string[]
  duration_range: [number, number]
  frame_rate_range?: [number, number]
  num_frames_range?: [number, number]
  fields: string[]
  form: 'agnes_video'
}

export interface Wan30VideoCapabilities {
  supported_resolutions: string[]
  supported_ratios: string[]
  duration_range: [number, number]
  smart_duration: boolean
  media_types: string[]
  modes: string[]
  fields: string[]
  form: 'wan30_video'
}

export interface GenericCapabilities {
  supported_sizes: string[]
  duration_range: [number, number]
  fields: string[]
  form: 'generic'
}

export interface PlaygroundVideoModel {
  model: string
  tags: string[]
  groups: string[]
  profile: VideoRequestProfile
  label: string
  capabilities:
    | HappyHorseCapabilities
    | SeedanceCapabilities
    | MiniMaxH3Capabilities
    | AgnesVideoCapabilities
    | Wan30VideoCapabilities
    | GenericCapabilities
}

export interface VideoTaskResponse {
  id: string
  task_id?: string
  object: string
  model: string
  status: VideoTaskStatus
  progress: number
  created_at: number
  completed_at?: number
  error?: { message: string; code: string }
  metadata?: Record<string, unknown>
}

export interface VideoTaskItem {
  id: string
  model: string
  prompt: string
  status: VideoTaskStatus
  progress: number
  createdAt: number
  completedAt?: number
  videoUrl?: string
  error?: string
  size?: string
  duration?: number
  profile?: VideoRequestProfile
  tokenId?: number
}

// ========== Image generation types ==========

export type ImageRequestProfile =
  | 'dalle2'
  | 'dalle3'
  | 'gpt_image'
  | 'agnes_image'
  | 'generic'

export interface ImageCapabilities {
  supported_sizes: string[]
  n_range: [number, number]
  fields: string[]
}

export interface PlaygroundImageModel {
  model: string
  tags: string[]
  groups: string[]
  profile: ImageRequestProfile
  label: string
  capabilities: ImageCapabilities
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  n?: number
  size?: string
}

export interface ImageGenerationDataItem {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageGenerationResponse {
  created: number
  data: ImageGenerationDataItem[]
  error?: { message: string; code?: string }
}

export interface ImageHistoryItem {
  id: string
  model: string
  prompt: string
  size?: string
  n: number
  createdAt: number
  images: Array<{
    id: string
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
  profile?: ImageRequestProfile
}
