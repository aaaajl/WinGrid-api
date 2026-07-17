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
  ImageGenerationRequest,
  ImageRequestProfile,
  PlaygroundImageModel,
} from '../../types'

export interface ImageFormState {
  model: string
  prompt: string
  size: string
  n: number
}

export function getDefaultImageFormState(
  model: PlaygroundImageModel
): ImageFormState {
  const sizes = model.capabilities.supported_sizes
  const [minN] = model.capabilities.n_range
  return {
    model: model.model,
    prompt: '',
    size: sizes[0] ?? '1024x1024',
    n: minN > 0 ? minN : 1,
  }
}

export function buildImageRequest(
  state: ImageFormState,
  profile?: ImageRequestProfile
): ImageGenerationRequest {
  const req: ImageGenerationRequest = {
    model: state.model,
    prompt: state.prompt.trim(),
    size: state.size,
  }
  // Agnes Image API does not accept OpenAI's n parameter.
  if (profile !== 'agnes_image') {
    req.n = Math.max(1, Math.floor(state.n))
  }
  return req
}
