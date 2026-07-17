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
  GenericCapabilities,
  HappyHorseCapabilities,
  PlaygroundVideoModel,
  SeedanceCapabilities,
  VideoGenerationRequest,
  VideoRequestProfile,
} from '../types'

export function getVideoRequestProfile(modelName: string): VideoRequestProfile {
  if (modelName.startsWith('happyhorse-')) return 'happyhorse'
  if (modelName.startsWith('doubao-seedance-')) return 'seedance'
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
  resolution: string
  ratio: string
  duration: number
  watermark: boolean
  seed?: number
  cameraFixed: boolean
  generateAudio: boolean
}

export interface GenericFormState {
  model: string
  prompt: string
  size: string
  duration: number
}

export function buildHappyHorseVideoRequest(
  state: HappyHorseFormState
): VideoGenerationRequest {
  return {
    model: state.model,
    prompt: state.prompt.trim(),
    size: state.size,
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
    duration: state.duration,
    metadata: {
      resolution: state.resolution,
      ratio: state.ratio,
      watermark: state.watermark,
      camera_fixed: state.cameraFixed,
      generate_audio: state.generateAudio,
      ...(state.seed != null ? { seed: state.seed } : {}),
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
  state: HappyHorseFormState | SeedanceFormState | GenericFormState
): VideoGenerationRequest {
  if (profile === 'happyhorse') {
    return buildHappyHorseVideoRequest(state as HappyHorseFormState)
  }
  if (profile === 'seedance') {
    return buildSeedanceVideoRequest(state as SeedanceFormState)
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
  return 'supported_resolutions' in capabilities
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
    resolution: caps.supported_resolutions[0] ?? '720p',
    ratio: caps.supported_ratios[0] ?? '16:9',
    duration: caps.duration_range[0] ?? 5,
    watermark: false,
    cameraFixed: false,
    generateAudio: false,
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
