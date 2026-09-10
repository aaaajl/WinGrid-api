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
  getNoticeDialogDefaultTab,
  shouldAutoShowNoticeDialog,
} from '../notice-auto-show'

describe('shouldAutoShowNoticeDialog', () => {
  test('opens when there is an unread system notice', () => {
    assert.equal(
      shouldAutoShowNoticeDialog({
        closedToday: false,
        hasUnreadNotice: true,
        hasUnreadAnnouncements: false,
      }),
      true
    )
  })

  test('opens when there are unread timeline announcements', () => {
    assert.equal(
      shouldAutoShowNoticeDialog({
        closedToday: false,
        hasUnreadNotice: false,
        hasUnreadAnnouncements: true,
      }),
      true
    )
  })

  test('does not open after Close Today', () => {
    assert.equal(
      shouldAutoShowNoticeDialog({
        closedToday: true,
        hasUnreadNotice: true,
        hasUnreadAnnouncements: true,
      }),
      false
    )
  })

  test('does not open when notice and announcements are already read', () => {
    assert.equal(
      shouldAutoShowNoticeDialog({
        closedToday: false,
        hasUnreadNotice: false,
        hasUnreadAnnouncements: false,
      }),
      false
    )
  })
})

describe('getNoticeDialogDefaultTab', () => {
  test('prefers the announcements tab when timeline items are unread', () => {
    assert.equal(
      getNoticeDialogDefaultTab({ hasUnreadAnnouncements: true }),
      'announcements'
    )
  })

  test('falls back to the notice tab when the timeline is fully read', () => {
    assert.equal(
      getNoticeDialogDefaultTab({ hasUnreadAnnouncements: false }),
      'notice'
    )
  })
})
