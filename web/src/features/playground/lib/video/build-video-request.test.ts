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

import {
  buildGenericVideoRequest,
  buildHappyHorseVideoRequest,
  buildSeedanceVideoRequest,
  buildVideoRequest,
} from './build-video-request'

describe('buildVideoRequest', () => {
  test('buildHappyHorseVideoRequest matches happyhorse adaptor contract', () => {
    const req = buildHappyHorseVideoRequest({
      model: 'happyhorse-1.0-t2v',
      prompt: 'A cat running',
      size: '1080P',
      duration: 8,
      promptExtend: true,
      watermark: false,
      seed: 42,
    })

    assert.deepEqual(req, {
      model: 'happyhorse-1.0-t2v',
      prompt: 'A cat running',
      resolution: '1080P',
      duration: 8,
      metadata: {
        prompt_extend: true,
        watermark: false,
        seed: 42,
      },
    })
  })

  test('buildSeedanceVideoRequest matches doubao adaptor contract', () => {
    const req = buildSeedanceVideoRequest({
      model: 'doubao-seedance-1-0-lite-t2v',
      prompt: 'Ocean waves',
      size: '720p',
      ratio: '16:9',
      duration: 5,
      watermark: true,
      cameraFixed: false,
      generateAudio: true,
      seed: 7,
    })

    assert.deepEqual(req, {
      model: 'doubao-seedance-1-0-lite-t2v',
      prompt: 'Ocean waves',
      size: '720p',
      duration: 5,
      metadata: {
        resolution: '720p',
        ratio: '16:9',
        watermark: true,
        camera_fixed: false,
        generate_audio: true,
        seed: 7,
      },
    })
  })

  test('buildGenericVideoRequest matches TaskSubmitReq contract', () => {
    const req = buildGenericVideoRequest({
      model: 'agnes-video-v2.0',
      prompt: 'A bird flying',
      size: '1080P',
      duration: 6,
    })

    assert.deepEqual(req, {
      model: 'agnes-video-v2.0',
      prompt: 'A bird flying',
      size: '1080P',
      duration: 6,
    })
  })

  test('buildVideoRequest delegates by profile', () => {
    const req = buildVideoRequest('generic', {
      model: 'agnes-video-v2.0',
      prompt: 'City night',
      size: '720P',
      duration: 5,
    })

    assert.equal(req.model, 'agnes-video-v2.0')
    assert.equal(req.size, '720P')
    assert.equal(req.duration, 5)
  })
})
