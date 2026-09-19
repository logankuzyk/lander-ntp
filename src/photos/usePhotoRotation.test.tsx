import { act, renderHook, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeManifest, makePhoto } from '@/test/fixtures'

import type { Frequency, PhotoSettings } from './rotation'
import { manifestCache, photoState } from './storage'
import { usePhotoRotation } from './usePhotoRotation'

const IDS = ['a', 'b', 'c']
const WATER = { slug: 'water', name: 'Water' }

const cycle = (frequency: Frequency, tag: string | null = null): PhotoSettings => ({
  mode: 'cycle',
  frequency,
  tag,
  pinnedId: null,
})

const pinned = (pinnedId: string | null): PhotoSettings => ({
  mode: 'pinned',
  frequency: 'every-visit',
  tag: null,
  pinnedId,
})

/** Cached manifest (so nothing is fetched) and a photo already showing. Only c is tagged. */
const seed = async (currentId = 'a') => {
  await manifestCache.setValue({
    etag: null,
    fetchedAt: Date.now(),
    data: makeManifest(IDS.map((id) => makePhoto(id, { tags: id === 'c' ? [WATER] : [] }))),
  })
  await photoState.setValue({ currentId, shownAt: Date.now(), bag: ['b'] })
}

/** What another tab writing to the shared state looks like from here. */
const anotherTabShows = (currentId: string) =>
  act(async () => {
    await photoState.setValue({ currentId, shownAt: Date.now(), bag: ['c'] })
  })

const renderRotation = (initial: PhotoSettings | null) =>
  renderHook((settings: PhotoSettings | null) => usePhotoRotation(settings), {
    initialProps: initial,
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePhotoRotation', () => {
  it.each([cycle('daily'), pinned(null), cycle('1h')])(
    'shows the shared photo and follows another tab (%o)',
    async (settings) => {
      await seed()
      const { result } = renderRotation(settings)

      await waitFor(() => expect(result.current.photo?.id).toBe('a'))

      await anotherTabShows('b')

      await waitFor(() => expect(result.current.photo?.id).toBe('b'))
    },
  )

  it('keeps this tab’s own photo when every new tab gets its own', async () => {
    await seed()
    const { result } = renderRotation(cycle('every-visit'))

    // A new tab moves on from the stored photo.
    await waitFor(() => expect(result.current.photo?.id).toBe('b'))

    await anotherTabShows('a')

    // Another tab opening must not change what this one is showing.
    expect(result.current.photo?.id).toBe('b')
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('shares the photo when the next-photo button is pressed', async () => {
    await seed()
    const { result } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    let shown: string | null = null
    await act(async () => {
      shown = await result.current.next()
    })

    expect(shown).not.toBe('a')
    expect(result.current.photo?.id).toBe(shown)
    // Written to the shared state, so other tabs pick it up.
    expect((await photoState.getValue())?.currentId).toBe(shown)
  })

  it('moves on by itself once the interval is up', async () => {
    vi.useFakeTimers()
    try {
      await seed()
      const { result } = renderRotation(cycle('30s'))
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

  it('waits for the stored settings before deciding anything', async () => {
    await seed()
    const { result, rerender } = renderRotation(null)

    // Settings haven't loaded yet: nothing decided, nothing written.
    await act(async () => {})
    expect(result.current.photo).toBeNull()
    expect((await photoState.getValue())?.currentId).toBe('a')

    rerender(cycle('daily'))

    // The stored setting says daily, so this tab shows the photo it was already on.
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('does not move on when only the frequency changes', async () => {
    await seed()
    const { result, rerender } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    rerender(cycle('every-visit'))

    await act(async () => {})
    expect(result.current.photo?.id).toBe('a')
  })

  it('shows a pinned photo, in a new tab and when it is pinned later', async () => {
    await seed()
    const { result, rerender } = renderRotation(pinned('c'))
    await waitFor(() => expect(result.current.photo?.id).toBe('c'))

    rerender(pinned('b'))

    await waitFor(() => expect(result.current.photo?.id).toBe('b'))
    expect((await photoState.getValue())?.currentId).toBe('b')
    // Nothing to preload: the photo stays.
    expect(result.current.upcoming).toBeNull()
  })

  it('keeps the photo on screen when pinned without one named', async () => {
    await seed('b')
    const { result } = renderRotation(pinned(null))

    await waitFor(() => expect(result.current.photo?.id).toBe('b'))
  })

  it('moves to a photo with the tag when cycling one', async () => {
    await seed()
    const { result, rerender } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    rerender(cycle('daily', 'water'))

    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    let shown: string | null = null
    await act(async () => {
      shown = await result.current.next()
    })
    // Only c has the tag.
    expect(shown).toBe('c')
  })

  it('preloads the photo that comes next', async () => {
    await seed()
    const { result } = renderRotation(cycle('daily'))

    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect(result.current.upcoming?.id).toBe('b')
  })
})
