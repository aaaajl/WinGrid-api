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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PlaygroundImageModel } from '../../types'
import {
  buildImageRequest,
  getDefaultImageFormState,
} from './build-image-request'

describe('buildImageRequest', () => {
  test('builds OpenAI images generations payload', () => {
    const req = buildImageRequest(
      {
        model: 'dall-e-3',
        prompt: '  A calm lake  ',
        size: '1024x1024',
        n: 1,
      },
      'dalle3'
    )

    assert.deepEqual(req, {
      model: 'dall-e-3',
      prompt: 'A calm lake',
      size: '1024x1024',
      n: 1,
    })
  })

  test('omits n for agnes_image profile', () => {
    const req = buildImageRequest(
      {
        model: 'agnes-image-2.0-flash',
        prompt: 'A dog running',
        size: '1024x1024',
        n: 1,
      },
      'agnes_image'
    )

    assert.deepEqual(req, {
      model: 'agnes-image-2.0-flash',
      prompt: 'A dog running',
      size: '1024x1024',
    })
    assert.equal('n' in req, false)
  })

  test('getDefaultImageFormState uses first size and min n', () => {
    const model: PlaygroundImageModel = {
      model: 'dall-e-3',
      tags: ['t2i'],
      groups: ['default'],
      profile: 'dalle3',
      label: 'dall-e-3',
      capabilities: {
        supported_sizes: ['1024x1024', '1024x1792'],
        n_range: [1, 1],
        fields: ['prompt', 'size', 'n'],
      },
    }

    assert.deepEqual(getDefaultImageFormState(model), {
      model: 'dall-e-3',
      prompt: '',
      size: '1024x1024',
      n: 1,
    })
  })
})
