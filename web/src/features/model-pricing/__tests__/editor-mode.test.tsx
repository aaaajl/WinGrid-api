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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import type { BillingUsageSchema } from '@/features/pricing/types'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
  type ModelRatioData,
} from '@/features/system-settings/models/model-pricing-sheet'
import { api } from '@/lib/api'

const clients: QueryClient[] = []

const videoSchema: BillingUsageSchema = {
  seconds: { type: 'number', unit: 'second' },
  resolution: { enum: ['480P', '720P', '1080P'] },
}

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

function renderPanel(editData: ModelRatioData) {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: [
        {
          model_name: editData.name,
          billing_usage_schema: videoSchema,
        },
      ],
      vendors: [],
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const ref = createRef<ModelPricingEditorPanelHandle>()
  render(
    <QueryClientProvider client={client}>
      <ModelPricingEditorPanel ref={ref} editData={editData} />
    </QueryClientProvider>
  )
  return { ref, client }
}

async function commit(
  ref: React.RefObject<ModelPricingEditorPanelHandle | null>
) {
  let result: ModelRatioData | null = null
  await act(async () => {
    result = (await ref.current?.commitDraft()) ?? null
  })
  return result as ModelRatioData | null
}

it('keeps a configured per-duration task model on its own mode instead of switching to expression pricing', async () => {
  const { ref, client } = renderPanel({
    name: 'wan3.0-video',
    billingMode: 'per_duration',
    fallbackPrice: '5',
    sizePrices: [{ size: '1080P', price: '2' }],
  })

  await waitFor(() => expect(client.isFetching()).toBe(0))
  await act(async () => {})

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Per-duration' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  )
  expect(screen.getByRole('tab', { name: 'Expression' })).toHaveAttribute(
    'aria-selected',
    'false'
  )
  expect(
    screen.queryByText(
      'All combinations are priced at zero. Matching requests will be billed as free.'
    )
  ).not.toBeInTheDocument()

  expect(await commit(ref)).toMatchObject({
    billingMode: 'per_duration',
    fallbackPrice: '5',
    sizePrices: [{ size: '1080P', price: '2' }],
  })
})

it('still opens the expression editor for a task model with no pricing configured', async () => {
  const { client } = renderPanel({
    name: 'wan3.0-video',
    billingMode: 'per-token',
    ratio: '',
  })

  await waitFor(() => expect(client.isFetching()).toBe(0))
  await act(async () => {})

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Expression' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  )
})
