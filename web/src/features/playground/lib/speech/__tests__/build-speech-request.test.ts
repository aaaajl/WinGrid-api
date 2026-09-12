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
import { describe, expect, test } from 'vitest'

import type { PlaygroundSpeechModel } from '../../../types'
import {
  buildSpeechRequest,
  getDefaultSpeechFormState,
} from '../build-speech-request'

describe('buildSpeechRequest', () => {
  test('builds an OpenAI-compatible speech payload and trims text', () => {
    const req = buildSpeechRequest({
      model: 'tts-1',
      input: '  Hello world  ',
      voice: 'alloy',
      responseFormat: 'mp3',
      speed: 1.25,
      instructions: '  Speak warmly  ',
    })

    expect(req).toEqual({
      model: 'tts-1',
      input: 'Hello world',
      voice: 'alloy',
      response_format: 'mp3',
      speed: 1.25,
      instructions: 'Speak warmly',
    })
  })

  test('omits empty voice, format, speed, and instructions', () => {
    const req = buildSpeechRequest({
      model: 'custom-speech',
      input: 'Hi',
      voice: '   ',
      responseFormat: '',
      speed: 0,
      instructions: '',
    })

    expect(req).toEqual({ model: 'custom-speech', input: 'Hi' })
  })
})

describe('getDefaultSpeechFormState', () => {
  test('uses the first voice/format and a usable speed', () => {
    const model: PlaygroundSpeechModel = {
      model: 'tts-1',
      tags: ['t2a'],
      groups: ['default'],
      profile: 'openai',
      label: 'tts-1',
      capabilities: {
        voices: ['alloy', 'nova'],
        response_formats: ['mp3', 'wav'],
        speed_range: [0.25, 4],
        fields: ['voice', 'response_format', 'speed', 'instructions'],
        allow_custom_voice: false,
      },
    }

    expect(getDefaultSpeechFormState(model)).toEqual({
      model: 'tts-1',
      input: '',
      voice: 'alloy',
      responseFormat: 'mp3',
      speed: 1,
      instructions: '',
    })
  })

  test('clamps the default speed into the supported range', () => {
    const model: PlaygroundSpeechModel = {
      model: 'MiniMax-Speech-02',
      tags: ['t2a'],
      groups: ['default'],
      profile: 'minimax',
      label: 'MiniMax-Speech-02',
      capabilities: {
        voices: [],
        response_formats: ['mp3'],
        speed_range: [0.5, 0.8],
        fields: ['speed'],
        allow_custom_voice: true,
      },
    }

    expect(getDefaultSpeechFormState(model).speed).toBe(0.8)
  })

  test('defaults the qwen voice to a model-supported voice and leaves speed off', () => {
    const model: PlaygroundSpeechModel = {
      model: 'qwen-audio-3.0-tts-flash',
      tags: ['t2a'],
      groups: ['default'],
      profile: 'qwen',
      label: 'qwen-audio-3.0-tts-flash',
      capabilities: {
        voices: ['longanhuan_v3.6', 'loongjohn'],
        response_formats: [],
        speed_range: [0, 0],
        fields: ['voice'],
        allow_custom_voice: true,
      },
    }

    const state = getDefaultSpeechFormState(model)
    // DashScope rejects a voice owned by another model with
    // "[cosyvoice:]Engine error [411]", so the default must come from the
    // model's own list instead of a hardcoded OpenAI voice.
    expect(state.voice).toBe('longanhuan_v3.6')
    expect(state.speed).toBe(0)
    expect(buildSpeechRequest(state)).toEqual({
      model: 'qwen-audio-3.0-tts-flash',
      input: '',
      voice: 'longanhuan_v3.6',
    })
  })

  test('tolerates capability arrays encoded as null', () => {
    // Go marshals omitted slices as null; indexing them used to crash the
    // whole playground after opening the Speech tab.
    const model = {
      model: 'qwen-audio-3.0-tts-flash',
      tags: ['t2a'],
      groups: ['default'],
      profile: 'qwen',
      label: 'qwen-audio-3.0-tts-flash',
      capabilities: {
        voices: null,
        response_formats: null,
        speed_range: [0, 0],
        fields: ['voice'],
        allow_custom_voice: true,
      },
    } as unknown as PlaygroundSpeechModel

    expect(getDefaultSpeechFormState(model)).toEqual({
      model: 'qwen-audio-3.0-tts-flash',
      input: '',
      voice: '',
      responseFormat: '',
      speed: 0,
      instructions: '',
    })
  })
})
