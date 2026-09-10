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

import type { TokenOption } from '../../types'
import {
  getCompatibleTokens,
  selectCompatibleTokenId,
} from '../api-key-selection'

const tokens: TokenOption[] = [
  {
    id: 1,
    name: 'SVIP key',
    key: 'sk-svip',
    group: 'SVIP',
    autoGroups: null,
  },
  {
    id: 2,
    name: 'Default key',
    key: 'sk-default',
    group: 'default',
    autoGroups: null,
  },
  {
    id: 3,
    name: 'Auto key',
    key: 'sk-auto',
    group: 'auto',
    autoGroups: ['default'],
  },
]

describe('Playground API key selection', () => {
  test('keeps only keys that can route to a model group', () => {
    const compatible = getCompatibleTokens(tokens, ['default'], 'SVIP', [])

    assert.deepEqual(
      compatible.map((token) => token.id),
      [2, 3]
    )
  })

  test('uses inherited Auto groups when the key has no custom list', () => {
    const inheritedAutoToken: TokenOption = {
      ...tokens[2],
      autoGroups: null,
    }

    assert.equal(
      getCompatibleTokens([inheritedAutoToken], ['default'], 'SVIP', [
        'default',
      ]).length,
      1
    )
  })

  test('switches away from an incompatible selected key', () => {
    assert.equal(selectCompatibleTokenId([tokens[1]], '1', ''), '2')
  })

  test('returns no selection when a matching key does not exist', () => {
    assert.equal(selectCompatibleTokenId([], '1', '2'), '')
  })
})
