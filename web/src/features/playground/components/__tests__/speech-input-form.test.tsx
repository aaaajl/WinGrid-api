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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { STORAGE_KEYS_SPEECH } from '../../constants'
import type { PlaygroundSpeechModel } from '../../types'
import { SpeechInputForm } from '../speech-input-form'

vi.mock('../../api', () => ({
  getUserTokens: vi.fn(async () => [
    { id: 1, name: 'default', key: 'sk-test', group: 'default', autoGroups: null },
  ]),
  getInheritedTokenAutoGroups: vi.fn(async () => []),
  fetchTokenKey: vi.fn(async () => 'sk-test'),
}))

const qwenModel: PlaygroundSpeechModel = {
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

describe('SpeechInputForm voice control', () => {
  afterEach(() => {
    localStorage.clear()
  })

  test('offers the model voices and still accepts a typed voice id', async () => {
    const user = userEvent.setup()
    render(<SpeechInputForm speechModels={[qwenModel]} onSubmit={vi.fn()} />)

    const voice = screen.getByRole('combobox', { name: 'Voice' })

    // DashScope answers a voice owned by another model with 400
    // "[cosyvoice:]Engine error [411]", so the control must list this model's
    // own voices instead of suggesting an arbitrary OpenAI voice.
    await user.click(voice)
    await user.click(await screen.findByRole('option', { name: 'loongjohn' }))
    expect(voice).toHaveValue('loongjohn')

    // Cloned DashScope voices are not enumerable, so a typed id must stick.
    await user.clear(voice)
    await user.type(voice, 'qwen-audio-3.0-tts-flash-clone01')
    expect(voice).toHaveValue('qwen-audio-3.0-tts-flash-clone01')
  })

  test('drops a draft saved before the model exposed its voice list', () => {
    // Drafts written when the voice list was empty could hold any voice,
    // including one this model rejects. Restoring it would silently repeat the
    // failed request, so the form must fall back to the model default.
    localStorage.setItem(
      STORAGE_KEYS_SPEECH.DRAFT,
      JSON.stringify({
        model: 'qwen-audio-3.0-tts-flash',
        tokenId: '',
        form: {
          model: 'qwen-audio-3.0-tts-flash',
          input: 'read me',
          voice: 'Cherry',
          responseFormat: '',
          speed: 0,
          instructions: '',
        },
      })
    )

    render(<SpeechInputForm speechModels={[qwenModel]} onSubmit={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Voice' })).toHaveValue(
      'longanhuan_v3.6'
    )
  })
})
