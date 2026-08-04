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
import type {
  AgnesVideoCapabilities,
  GenericCapabilities,
  HappyHorseCapabilities,
  MiniMaxH3Capabilities,
  PlaygroundVideoModel,
  SeedanceCapabilities,
  VideoGenerationRequest,
  VideoRequestProfile,
} from '../types'

export function getVideoRequestProfile(modelName: string): VideoRequestProfile {
  if (modelName.startsWith('happyhorse-')) return 'happyhorse'
  if (modelName.startsWith('doubao-seedance-')) return 'seedance'
  if (modelName.toLowerCase() === 'minimax-h3') return 'minimax_h3'
  if (modelName.toLowerCase().startsWith('agnes-video-')) return 'agnes_video'
  return 'generic'
}

export interface HappyHorseFormState {
  model: string
  prompt: string
  size: string
  duration: number
  promptExtend: boolean
  watermark: boolean
  seed?: number
}

export interface SeedanceFormState {
  model: string
  prompt: string
  size: string
  ratio: string
  duration: number
  watermark: boolean
  seed?: number
  cameraFixed: boolean
  generateAudio: boolean
}

export interface MiniMaxH3FormState {
  model: string
  prompt: string
  resolution: string
  duration: number
  ratio: string
  aigcWatermark: boolean
}

export interface AgnesVideoFormState {
  model: string
  prompt: string
  size: string
  ratio: string
  duration: number
  frameRate: number
  numFrames?: number
  seed?: number
  negativePrompt?: string
  image?: string
}

export interface GenericFormState {
  model: string
  prompt: string
  size: string
  duration: number
}

export type VideoFormState =
  | HappyHorseFormState
  | SeedanceFormState
  | MiniMaxH3FormState
  | AgnesVideoFormState
  | GenericFormState

/** Map playground size+ratio to Agnes WxH accepted by the adaptor. */
const AGNES_SIZE_BY_RATIO: Record<string, Record<string, string>> = {
  '480P': {
    '16:9': '832x448',
    '9:16': '448x832',
    '1:1': '512x512',
  },
  '720P': {
    '16:9': '1280x720',
    '9:16': '720x1280',
    '1:1': '720x720',
  },
  '1080P': {
    '16:9': '1920x1080',
    '9:16': '1080x1920',
    '1:1': '1080x1080',
  },
}

export function resolveAgnesVideoSize(size: string, ratio: string): string {
  const byRatio = AGNES_SIZE_BY_RATIO[size]
  if (byRatio?.[ratio]) return byRatio[ratio]
  return size
}

export function buildHappyHorseVideoRequest(
  state: HappyHorseFormState
): VideoGenerationRequest {
  return {
    model: state.model,
    prompt: state.prompt.trim(),
    // HappyHorse upstream uses parameters.resolution; gateway aliases this to size.
    resolution: state.size,
    duration: state.duration,
    metadata: {
      prompt_extend: state.promptExtend,
      watermark: state.watermark,
      ...(state.seed != null ? { seed: state.seed } : {}),
    },
  }
}

export function buildSeedanceVideoRequest(
  state: SeedanceFormState
): VideoGenerationRequest {
  return {
    model: state.model,
    prompt: state.prompt.trim(),
    size: state.size,
    duration: state.duration,
    metadata: {
      // Doubao upstream still reads metadata.resolution; mirror top-level size.
      resolution: state.size,
      ratio: state.ratio,
      watermark: state.watermark,
      camera_fixed: state.cameraFixed,
      generate_audio: state.generateAudio,
      ...(state.seed != null ? { seed: state.seed } : {}),
    },
  }
}

export function buildMiniMaxH3VideoRequest(
  state: MiniMaxH3FormState
): VideoGenerationRequest {
  const prompt = state.prompt.trim()
  return {
    model: state.model,
    // Kept for task-queue display; hailuo_v2 ignores unknown fields.
    prompt,
    content: [{ type: 'text', text: prompt }],
    resolution: state.resolution,
    duration: state.duration,
    ratio: state.ratio,
    aigc_watermark: state.aigcWatermark,
  }
}

export function buildAgnesVideoRequest(
  state: AgnesVideoFormState
): VideoGenerationRequest {
  const prompt = state.prompt.trim()
  const size = resolveAgnesVideoSize(state.size, state.ratio)
  const image = state.image?.trim()
  const negativePrompt = state.negativePrompt?.trim()

  return {
    model: state.model,
    prompt,
    size,
    duration: state.duration,
    ...(image ? { image } : {}),
    metadata: {
      frame_rate: state.frameRate,
      ...(state.numFrames != null ? { num_frames: state.numFrames } : {}),
      ...(state.seed != null ? { seed: state.seed } : {}),
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      ...(image ? { image } : {}),
    },
  }
}

export function buildGenericVideoRequest(
  state: GenericFormState
): VideoGenerationRequest {
  return {
    model: state.model,
    prompt: state.prompt.trim(),
    size: state.size,
    duration: state.duration,
  }
}

export function buildVideoRequest(
  profile: VideoRequestProfile,
  state: VideoFormState
): VideoGenerationRequest {
  if (profile === 'happyhorse') {
    return buildHappyHorseVideoRequest(state as HappyHorseFormState)
  }
  if (profile === 'seedance') {
    return buildSeedanceVideoRequest(state as SeedanceFormState)
  }
  if (profile === 'minimax_h3') {
    return buildMiniMaxH3VideoRequest(state as MiniMaxH3FormState)
  }
  if (profile === 'agnes_video') {
    return buildAgnesVideoRequest(state as AgnesVideoFormState)
  }
  return buildGenericVideoRequest(state as GenericFormState)
}

export function isHappyHorseCapabilities(
  capabilities: PlaygroundVideoModel['capabilities']
): capabilities is HappyHorseCapabilities {
  return (
    'supported_sizes' in capabilities &&
    !('form' in capabilities) &&
    !('supported_resolutions' in capabilities)
  )
}

export function isSeedanceCapabilities(
  capabilities: PlaygroundVideoModel['capabilities']
): capabilities is SeedanceCapabilities {
  return (
    'supported_resolutions' in capabilities &&
    !('form' in capabilities)
  )
}

export function isMiniMaxH3Capabilities(
  capabilities: PlaygroundVideoModel['capabilities']
): capabilities is MiniMaxH3Capabilities {
  return 'form' in capabilities && capabilities.form === 'minimax_h3'
}

export function isAgnesVideoCapabilities(
  capabilities: PlaygroundVideoModel['capabilities']
): capabilities is AgnesVideoCapabilities {
  return 'form' in capabilities && capabilities.form === 'agnes_video'
}

export function isGenericCapabilities(
  capabilities: PlaygroundVideoModel['capabilities']
): capabilities is GenericCapabilities {
  return 'form' in capabilities && capabilities.form === 'generic'
}

export function getDefaultHappyHorseFormState(
  model: PlaygroundVideoModel
): HappyHorseFormState {
  const caps = isHappyHorseCapabilities(model.capabilities)
    ? model.capabilities
    : {
        supported_sizes: ['720P', '1080P'],
        duration_range: [2, 15] as [number, number],
      }

  return {
    model: model.model,
    prompt: '',
    size: caps.supported_sizes[0] ?? '720P',
    duration: caps.duration_range[0] ?? 5,
    promptExtend: true,
    watermark: false,
  }
}

export function getDefaultSeedanceFormState(
  model: PlaygroundVideoModel
): SeedanceFormState {
  const caps = isSeedanceCapabilities(model.capabilities)
    ? model.capabilities
    : {
        supported_resolutions: ['480p', '720p', '1080p'],
        supported_ratios: ['16:9', '9:16', '1:1'],
        duration_range: [2, 12] as [number, number],
      }

  return {
    model: model.model,
    prompt: '',
    size: caps.supported_resolutions[0] ?? '720p',
    ratio: caps.supported_ratios[0] ?? '16:9',
    // Prefer a mid-range default; Seedance 1.5+ rejects very short clips.
    duration: Math.max(caps.duration_range[0] ?? 5, 5),
    watermark: false,
    cameraFixed: false,
    generateAudio: false,
  }
}

export function getDefaultMiniMaxH3FormState(
  model: PlaygroundVideoModel
): MiniMaxH3FormState {
  const caps = isMiniMaxH3Capabilities(model.capabilities)
    ? model.capabilities
    : {
        supported_resolutions: ['768P', '2K'],
        supported_ratios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        duration_range: [4, 15] as [number, number],
        form: 'minimax_h3' as const,
      }

  return {
    model: model.model,
    prompt: '',
    resolution: caps.supported_resolutions.includes('2K')
      ? '2K'
      : (caps.supported_resolutions[0] ?? '2K'),
    duration: Math.max(caps.duration_range[0] ?? 5, 5),
    ratio: caps.supported_ratios.includes('16:9')
      ? '16:9'
      : (caps.supported_ratios[0] ?? '16:9'),
    aigcWatermark: false,
  }
}

export function getDefaultAgnesVideoFormState(
  model: PlaygroundVideoModel
): AgnesVideoFormState {
  const caps = isAgnesVideoCapabilities(model.capabilities)
    ? model.capabilities
    : {
        supported_sizes: ['480P', '720P', '1080P'],
        supported_ratios: ['16:9', '9:16', '1:1'],
        duration_range: [1, 18] as [number, number],
        frame_rate_range: [1, 60] as [number, number],
        num_frames_range: [1, 441] as [number, number],
        form: 'agnes_video' as const,
      }

  return {
    model: model.model,
    prompt: '',
    size: caps.supported_sizes.includes('720P')
      ? '720P'
      : (caps.supported_sizes[0] ?? '720P'),
    ratio: caps.supported_ratios.includes('16:9')
      ? '16:9'
      : (caps.supported_ratios[0] ?? '16:9'),
    duration: Math.max(caps.duration_range[0] ?? 5, 5),
    frameRate: 24,
  }
}

export function getDefaultGenericFormState(
  model: PlaygroundVideoModel
): GenericFormState {
  const caps = isGenericCapabilities(model.capabilities)
    ? model.capabilities
    : {
        supported_sizes: ['720P', '1080P'],
        duration_range: [2, 15] as [number, number],
        form: 'generic' as const,
      }

  return {
    model: model.model,
    prompt: '',
    size: caps.supported_sizes[0] ?? '720P',
    duration: Math.max(caps.duration_range[0], 5),
  }
}
