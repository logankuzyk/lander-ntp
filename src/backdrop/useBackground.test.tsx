import { act, renderHook, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { BACKGROUND_HINT_KEY } from './paintHint'
import { backgroundItem, DEFAULT_BACKGROUND } from './storage'
import { useBackground } from './useBackground'

describe('useBackground', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
    localStorage.clear()
  })

  it('persists the stored colour hint when the background is read and changed', async () => {
    const { result } = renderHook(() => useBackground())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(JSON.parse(localStorage.getItem(BACKGROUND_HINT_KEY) ?? '')).toMatchObject({
      colour: '#ffffff',
      kind: 'photo',
    })

    await act(async () =>
      result.current.set({ ...DEFAULT_BACKGROUND, colour: '#f2e8cf', kind: 'colour' }),
    )
    await waitFor(() => expect(localStorage.getItem(BACKGROUND_HINT_KEY)).toContain('#f2e8cf'))
    expect(JSON.parse(localStorage.getItem(BACKGROUND_HINT_KEY) ?? '')).toEqual({
      colour: '#f2e8cf',
      ink: '#111',
      kind: 'colour',
    })
  })

  it('waits for the synced background before replacing the local hint', async () => {
    let resolveRead!: (value: Awaited<ReturnType<typeof backgroundItem.read>>) => void
    const pendingRead = new Promise<Awaited<ReturnType<typeof backgroundItem.read>>>((resolve) => {
      resolveRead = resolve
    })
    const read = vi.spyOn(backgroundItem, 'read').mockReturnValue(pendingRead)
    localStorage.setItem(
      BACKGROUND_HINT_KEY,
      JSON.stringify({ colour: '#f2e8cf', ink: '#111', kind: 'colour' }),
    )
    const { result } = renderHook(() => useBackground())

    await waitFor(() => expect(read).toHaveBeenCalledOnce())
    expect(localStorage.getItem(BACKGROUND_HINT_KEY)).toContain('#f2e8cf')
    expect(result.current.loaded).toBe(false)

    await act(async () =>
      resolveRead({
        newer: false,
        value: { ...DEFAULT_BACKGROUND, colour: '#1d3557', kind: 'colour' },
      }),
    )
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(localStorage.getItem(BACKGROUND_HINT_KEY)).toContain('#1d3557')
  })
})
