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

const LANGUAGE_ALIASES: Record<string, string[]> = {
  en: ['en', 'en-US', 'en-GB'],
  zhCN: ['zhCN', 'zh', 'zh-CN', 'zh-Hans'],
  zhTW: ['zhTW', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant'],
  fr: ['fr', 'fr-FR'],
  ja: ['ja', 'ja-JP'],
  ru: ['ru', 'ru-RU'],
  vi: ['vi', 'vi-VN'],
}

const FALLBACK_ORDER = ['en', 'zhCN', 'zhTW', 'fr', 'ja', 'ru', 'vi'] as const

function isLocalizedContentMap(
  value: unknown
): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return false
  }
  return entries.every(
    ([key, content]) =>
      typeof key === 'string' &&
      key.trim().length > 0 &&
      typeof content === 'string'
  )
}

/**
 * Resolve admin-configured legal content for the active UI language.
 *
 * Plain Markdown/HTML/URL strings are returned unchanged. When the stored
 * value is a JSON object whose values are strings (language -> content), the
 * entry matching `language` is returned, with English then other locales as
 * fallbacks.
 */
export function resolveLocalizedContent(
  raw: string,
  language: string
): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) {
    return raw
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return raw
  }

  if (!isLocalizedContentMap(parsed)) {
    return raw
  }

  const normalizedLanguage = language.trim()
  const aliasKeys =
    LANGUAGE_ALIASES[normalizedLanguage] ?? [normalizedLanguage]

  for (const key of aliasKeys) {
    const content = parsed[key]
    if (typeof content === 'string' && content.trim().length > 0) {
      return content
    }
  }

  for (const fallback of FALLBACK_ORDER) {
    for (const key of LANGUAGE_ALIASES[fallback] ?? [fallback]) {
      const content = parsed[key]
      if (typeof content === 'string' && content.trim().length > 0) {
        return content
      }
    }
  }

  const first = Object.values(parsed).find(
    (content) => typeof content === 'string' && content.trim().length > 0
  )
  return first ?? raw
}
