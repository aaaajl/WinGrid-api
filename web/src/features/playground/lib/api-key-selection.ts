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
import type { TokenOption } from '../types'

export function getCompatibleTokens(
  tokens: TokenOption[],
  modelGroups: string[],
  userGroup: string,
  inheritedAutoGroups: string[]
): TokenOption[] {
  const requiredGroups = new Set(modelGroups)
  return tokens.filter((token) => {
    let tokenGroups: string[]
    if (token.group === 'auto') {
      tokenGroups = token.autoGroups ?? inheritedAutoGroups
    } else {
      tokenGroups = [token.group || userGroup]
    }
    return tokenGroups.some((group) => requiredGroups.has(group))
  })
}

export function selectCompatibleTokenId(
  tokens: TokenOption[],
  currentTokenId: string,
  savedTokenId: string
): string {
  if (tokens.some((token) => String(token.id) === currentTokenId)) {
    return currentTokenId
  }
  if (tokens.some((token) => String(token.id) === savedTokenId)) {
    return savedTokenId
  }
  return tokens[0] ? String(tokens[0].id) : ''
}
