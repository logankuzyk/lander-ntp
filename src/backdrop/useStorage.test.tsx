import { act, render, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { useFavourites } from './useFavourites'

describe('the backdrop storage hooks', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await fakeBrowser.storage.sync.clear()
  })

  it('restores 300 stored favourites and calls onRejected when storage refuses an item at its limit', async () => {
    const old = {
      ids: Array.from({ length: 300 }, (_, index) => `photo-${String(index).padStart(18, '0')}`),
      v: 1 as const,
    }
    expect(new TextEncoder().encode(JSON.stringify(old)).byteLength).toBeLessThan(8192)
    await fakeBrowser.storage.sync.set({ favourites: old })
    const rejectWrite = vi
      .spyOn(fakeBrowser.storage.sync, 'set')
      .mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM'))
    const onRejected = vi.fn()
    const api = { set: (_value: typeof old) => {} }

    function Page() {
      const { loaded, readOnly, set, value } = useFavourites({ onRejected })
      api.set = set
      return (
        <output data-read-only={String(readOnly)}>
          {loaded ? String(value.ids.length) : 'loading'}
        </output>
      )
    }

    const page = render(<Page />)
    await waitFor(() => expect(page.container.textContent).toBe('300'))
    expect(page.container.querySelector('output')?.dataset.readOnly).toBe('false')

    const tooLarge = {
      ...old,
      ids: [...Array.from({ length: 10 }, (_, index) => `new-photo-${index}`), ...old.ids],
    }
    expect(new TextEncoder().encode(JSON.stringify(tooLarge)).byteLength).toBeGreaterThan(8192)
    act(() => api.set(tooLarge))
    await waitFor(() => expect(page.container.textContent).toBe('300'))
    await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
    expect(rejectWrite).toHaveBeenCalled()
    expect((await fakeBrowser.storage.sync.get('favourites')).favourites).toEqual(old)
  })
})
