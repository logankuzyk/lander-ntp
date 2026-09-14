import { act, renderHook, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeManifest, makePhoto } from '@/test/fixtures'

import type { Frequency } from './rotation'
import { manifestCache, photoState } from './storage'
import { usePhotoRotation } from './usePhotoRotation'

const IDS = ['a', 'b', 'c']

/** Cached manifest (so nothing is fetched) and a photo already showing. */
const seed = async (currentId = 'a') => {
  await manifestCache.setValue({
    etag: null,
    fetchedAt: Date.now(),
    data: makeManifest(IDS.map((id) => makePhoto(id))),
  })
  await photoState.setValue({ currentId, shownAt: Date.now(), bag: ['b'] })
}

/** What another tab writing to the shared state looks like from here. */
const anotherTabShows = (currentId: string) =>
  act(async () => {
    await photoState.setValue({ currentId, shownAt: Date.now(), bag: ['c'] })
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePhotoRotation', () => {
  it.each(['daily', 'off', '1h'] as const)(
    'shows the shared photo and follows another tab (%s)',
    async (frequency) => {
      await seed()
      const { result } = renderHook(() => usePhotoRotation(frequency))

      await waitFor(() => expect(result.current.photo?.id).toBe('a'))

      await anotherTabShows('b')

      await waitFor(() => expect(result.current.photo?.id).toBe('b'))
    },
  )

  it('keeps this tab’s own photo when every new tab gets its own', async () => {
    await seed()
    const { result } = renderHook(() => usePhotoRotation('every-visit'))

    // A new tab moves on from the stored photo.
    await waitFor(() => expect(result.current.photo?.id).toBe('b'))

    await anotherTabShows('a')

    // Another tab opening must not change what this one is showing.
    expect(result.current.photo?.id).toBe('b')
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('shares the photo when the next-photo button is pressed', async () => {
    await seed()
    const { result } = renderHook(() => usePhotoRotation('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    act(() => result.current.next())

    await waitFor(() => expect(result.current.photo?.id).not.toBe('a'))
    const shown = result.current.photo?.id
    // Written to the shared state, so other tabs pick it up.
    expect((await photoState.getValue())?.currentId).toBe(shown)
  })

  it('moves on by itself once the interval is up', async () => {
    vi.useFakeTimers()
    try {
      await seed()
      const { result } = renderHook(() => usePhotoRotation('30s'))
      // Async variant: it settles the storage promises between timers.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(result.current.photo?.id).toBe('a')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(result.current.photo?.id).toBe('b')
      expect((await photoState.getValue())?.currentId).toBe('b')
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the stored frequency before deciding anything', async () => {
    await seed()
    const { result, rerender } = renderHook(
      (frequency: Frequency | null) => usePhotoRotation(frequency),
      { initialProps: null as Frequency | null },
    )

    // Settings haven't loaded yet: nothing decided, nothing written.
    await act(async () => {})
    expect(result.current.photo).toBeNull()
    expect((await photoState.getValue())?.currentId).toBe('a')

    rerender('daily')

    // The stored setting says daily, so this tab shows the photo it was already on.
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('decides once, and does not re-decide when the setting is changed later', async () => {
    await seed()
    const { result, rerender } = renderHook(
      (frequency: Frequency | null) => usePhotoRotation(frequency),
      { initialProps: 'daily' as Frequency | null },
    )
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    rerender('every-visit')

    await act(async () => {})
    expect(result.current.photo?.id).toBe('a')
  })

  it('preloads the photo that comes next', async () => {
    await seed()
    const { result } = renderHook(() => usePhotoRotation('daily'))

    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect(result.current.upcoming?.id).toBe('b')
  })
})
