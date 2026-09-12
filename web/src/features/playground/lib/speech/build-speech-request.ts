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
  PlaygroundSpeechModel,
  SpeechGenerationRequest,
} from '../../types'

export interface SpeechFormState {
  model: string
  input: string
  voice: string
  responseFormat: string
  speed: number
  instructions: string
}

export function getDefaultSpeechFormState(
  model: PlaygroundSpeechModel
): SpeechFormState {
  // The API encodes omitted capability arrays as null, so never index them raw.
  const { capabilities } = model
  const voices = capabilities.voices ?? []
  const responseFormats = capabilities.response_formats ?? []
  const fields = capabilities.fields ?? []
  const [minSpeed, maxSpeed] = capabilities.speed_range ?? [0, 0]
  let speed = 0
  if (fields.includes('speed')) {
    if (minSpeed > 0 && maxSpeed >= minSpeed) {
      speed = Math.min(Math.max(1, minSpeed), maxSpeed)
    } else {
      speed = 1
    }
  }
  return {
    model: model.model,
    input: '',
    voice: voices[0] ?? '',
    responseFormat: responseFormats[0] ?? '',
    speed,
    instructions: '',
  }
}

export function buildSpeechRequest(
  state: SpeechFormState
): SpeechGenerationRequest {
  const req: SpeechGenerationRequest = {
    model: state.model,
    input: state.input.trim(),
  }
  const voice = state.voice.trim()
  if (voice) req.voice = voice
  if (state.responseFormat) req.response_format = state.responseFormat
  if (Number.isFinite(state.speed) && state.speed > 0) req.speed = state.speed
  const instructions = state.instructions.trim()
  if (instructions) req.instructions = instructions
  return req
}
