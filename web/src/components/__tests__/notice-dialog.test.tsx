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
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'HTMLDivElement',
  'Node',
  'Element',
  'Event',
  'PointerEvent',
  'MouseEvent',
  'KeyboardEvent',
  'FocusEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { NoticeDialog } = await import('../notice-dialog')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'System Announcements': 'System Announcements',
        'Latest platform updates and notices':
          'Latest platform updates and notices',
        'Close Today': 'Close Today',
        Close: 'Close',
        Notice: 'Notice',
        Timeline: 'Timeline',
        'Loading...': 'Loading...',
        'No announcements at this time': 'No announcements at this time',
        'No system announcements': 'No system announcements',
      },
    },
  },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type RenderedDialog = {
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
}

async function renderDialog(
  props: Partial<React.ComponentProps<typeof NoticeDialog>> = {}
): Promise<RenderedDialog> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <I18nextProvider i18n={i18n}>
        <NoticeDialog
          open
          onOpenChange={() => undefined}
          onCloseToday={() => undefined}
          activeTab='notice'
          onTabChange={() => undefined}
          notice='Scheduled maintenance tonight'
          announcements={[]}
          loading={false}
          {...props}
        />
      </I18nextProvider>
    )
  })

  return { container, root }
}

async function unmountDialog(rendered: RenderedDialog) {
  await act(async () => rendered.root.unmount())
  rendered.container.remove()
}

function dialogText(): string {
  return document.body.textContent ?? ''
}

describe('NoticeDialog', () => {
  afterEach(async () => {
    document.body.innerHTML = ''
  })

  after(() => {
    domWindow.close()
  })

  test('shows notice content and Close Today when open', async () => {
    const rendered = await renderDialog()

    assert.match(dialogText(), /Scheduled maintenance tonight/)
    assert.match(dialogText(), /Close Today/)
    assert.match(dialogText(), /Close/)

    await unmountDialog(rendered)
  })

  test('calls onCloseToday from the Close Today button', async () => {
    const closeTodayCalls: number[] = []
    const rendered = await renderDialog({
      onCloseToday: () => closeTodayCalls.push(1),
    })
    const closeToday = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Close Today')
    )

    assert.ok(closeToday)
    await act(async () => closeToday.click())
    assert.deepEqual(closeTodayCalls, [1])

    await unmountDialog(rendered)
  })

  test('does not keep notice content in the page when closed', async () => {
    const rendered = await renderDialog({ open: false })

    assert.doesNotMatch(dialogText(), /Scheduled maintenance tonight/)

    await unmountDialog(rendered)
  })
})
