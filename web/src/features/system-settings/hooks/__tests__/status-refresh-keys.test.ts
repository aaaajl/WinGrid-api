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

import { shouldRefreshFrontendStatus } from '../use-update-option'

describe('shouldRefreshFrontendStatus', () => {
  test('refreshes status after saving dashboard announcements', () => {
    assert.equal(
      shouldRefreshFrontendStatus('console_setting.announcements'),
      true
    )
    assert.equal(
      shouldRefreshFrontendStatus('console_setting.announcements_enabled'),
      true
    )
  })

  test('refreshes status for other console content panels', () => {
    for (const key of [
      'console_setting.api_info',
      'console_setting.api_info_enabled',
      'console_setting.faq',
      'console_setting.faq_enabled',
      'console_setting.uptime_kuma_groups',
      'console_setting.uptime_kuma_enabled',
    ]) {
      assert.equal(shouldRefreshFrontendStatus(key), true, key)
    }
  })

  test('does not refresh status for unrelated options', () => {
    assert.equal(shouldRefreshFrontendStatus('SMTPPort'), false)
    assert.equal(shouldRefreshFrontendStatus('ChannelAffinityEnabled'), false)
  })
})
