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
  buildAgnesVideoRequest,
  buildGenericVideoRequest,
  buildHappyHorseVideoRequest,
  buildMiniMaxH3VideoRequest,
  buildSeedanceVideoRequest,
  buildVideoRequest,
  buildWan30VideoRequest,
  getVideoRequestProfile,
  resolveAgnesVideoSize,
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

  test('buildMiniMaxH3VideoRequest matches hailuo_v2 adaptor contract', () => {
    const req = buildMiniMaxH3VideoRequest({
      model: 'MiniMax-H3',
      prompt: 'A city at night',
      resolution: '768P',
      duration: 5,
      ratio: '16:9',
      aigcWatermark: false,
    })

    assert.deepEqual(req, {
      model: 'MiniMax-H3',
      prompt: 'A city at night',
      content: [{ type: 'text', text: 'A city at night' }],
      resolution: '768P',
      duration: 5,
      ratio: '16:9',
      aigc_watermark: false,
    })
  })

  test('buildGenericVideoRequest matches TaskSubmitReq contract', () => {
    const req = buildGenericVideoRequest({
      model: 'kling-v1',
      prompt: 'A bird flying',
      size: '1080P',
      duration: 6,
    })

    assert.deepEqual(req, {
      model: 'kling-v1',
      prompt: 'A bird flying',
      size: '1080P',
      duration: 6,
    })
  })

  test('buildAgnesVideoRequest matches agensvideo adaptor contract', () => {
    const req = buildAgnesVideoRequest({
      model: 'agnes-video-v2.0',
      prompt: 'A bird flying',
      size: '720P',
      ratio: '16:9',
      duration: 5,
      frameRate: 24,
      numFrames: 121,
      seed: 7,
      negativePrompt: 'blurry',
      image: 'https://example.com/ref.png',
    })

    assert.deepEqual(req, {
      model: 'agnes-video-v2.0',
      prompt: 'A bird flying',
      size: '1280x720',
      duration: 5,
      image: 'https://example.com/ref.png',
      metadata: {
        frame_rate: 24,
        num_frames: 121,
        seed: 7,
        negative_prompt: 'blurry',
        image: 'https://example.com/ref.png',
      },
    })
  })

  test('buildAgnesVideoRequest for 2.5 keeps size tier and aspect_ratio', () => {
    const req = buildAgnesVideoRequest({
      model: 'agnes-video-2.5',
      prompt: 'Neon city after rain',
      size: '960P',
      ratio: '9:16',
      duration: 5,
      frameRate: 24,
      seed: 1101,
    })

    assert.deepEqual(req, {
      model: 'agnes-video-2.5',
      prompt: 'Neon city after rain',
      size: '960P',
      duration: 5,
      metadata: {
        aspect_ratio: '9:16',
        mode: 'text',
        seed: 1101,
      },
    })
  })

  test('buildAgnesVideoRequest for 2.5 maps image to keyframe metadata', () => {
    const req = buildAgnesVideoRequest({
      model: 'agnes-video-2.5',
      prompt: 'Walk to the window',
      size: '720P',
      ratio: '16:9',
      duration: 5,
      frameRate: 24,
      image: 'https://example.com/first.png',
    })

    assert.deepEqual(req, {
      model: 'agnes-video-2.5',
      prompt: 'Walk to the window',
      size: '720P',
      duration: 5,
      image: 'https://example.com/first.png',
      metadata: {
        aspect_ratio: '16:9',
        mode: 'keyframe',
        first_frame: 'https://example.com/first.png',
      },
    })
  })

  test('resolveAgnesVideoSize maps presets by ratio', () => {
    assert.equal(resolveAgnesVideoSize('1080P', '9:16'), '1080x1920')
    assert.equal(resolveAgnesVideoSize('480P', '1:1'), '512x512')
  })

  test('buildWan30VideoRequest emits only media for the selected mode', () => {
    const req = buildWan30VideoRequest({
      model: 'wan3.0-video',
      prompt: 'Move between two frames',
      mode: 'first_last_frame',
      resolution: '1080P',
      ratio: 'adaptive',
      duration: 5,
      audio: false,
      promptExtend: false,
      watermark: false,
      firstFrameUrl: 'https://example.com/first.png',
      lastFrameUrl: 'https://example.com/last.png',
      references: [
        {
          id: 'ignored-reference',
          type: 'reference_image',
          url: 'https://example.com/ignored.png',
        },
      ],
      fileUrl: 'https://example.com/ignored.pdf',
      linkUrl: 'https://example.com/ignored',
    })

    assert.deepEqual(req, {
      model: 'wan3.0-video',
      prompt: 'Move between two frames',
      size: '1080P',
      duration: 5,
      metadata: {
        ratio: 'adaptive',
        audio: false,
        prompt_extend: false,
        watermark: false,
        media: [
          { type: 'first_frame', url: 'https://example.com/first.png' },
          { type: 'last_frame', url: 'https://example.com/last.png' },
        ],
      },
    })
  })

  test('buildVideoRequest delegates by profile', () => {
    const req = buildVideoRequest('minimax_h3', {
      model: 'MiniMax-H3',
      prompt: 'City night',
      resolution: '2K',
      duration: 5,
      ratio: '9:16',
      aigcWatermark: true,
    })

    assert.equal(req.model, 'MiniMax-H3')
    assert.equal(req.resolution, '2K')
    assert.equal(req.ratio, '9:16')
    assert.equal(req.aigc_watermark, true)
    assert.deepEqual(req.content, [{ type: 'text', text: 'City night' }])
  })

  test('getVideoRequestProfile detects vendor prefixes', () => {
    assert.equal(getVideoRequestProfile('MiniMax-H3'), 'minimax_h3')
    assert.equal(getVideoRequestProfile('minimax-h3'), 'minimax_h3')
    assert.equal(getVideoRequestProfile('happyhorse-1.0-t2v'), 'happyhorse')
    assert.equal(getVideoRequestProfile('agnes-video-v2.0'), 'agnes_video')
    assert.equal(getVideoRequestProfile('wan3.0-video-prime'), 'wan30_video')
  })
})
