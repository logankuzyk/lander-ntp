import { act, renderHook, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_FAVOURITES, favouritesItem } from '@/backdrop/favourites'
import { backgroundItem, DEFAULT_BACKGROUND } from '@/backdrop/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import type { Frequency, PhotoSettings } from './rotation'
import { MANIFEST_CACHE_SHAPE, manifestCache, photoState } from './storage'
import { usePhotoRotation } from './usePhotoRotation'

const IDS = ['a', 'b', 'c']
const WATER = { name: 'Water', optIn: false, slug: 'water' }

const cycle = (frequency: Frequency, tags: string[] = []): PhotoSettings => ({
  frequency,
  mode: 'cycle',
  pinnedId: null,
  tags,
})

const pinned = (pinnedId: string | null): PhotoSettings => ({
  frequency: 'every-visit',
  mode: 'pinned',
  pinnedId,
  tags: [],
})

/** Cached manifest (so nothing is fetched) and a photo already showing. Only c is tagged. */
const seed = async (currentId = 'a') => {
  await manifestCache.setValue({
    data: makeManifest(IDS.map((id) => makePhoto(id, { tags: id === 'c' ? [WATER] : [] }))),
    etag: null,
    fetchedAt: Date.now(),
    shape: MANIFEST_CACHE_SHAPE,
  })
  await photoState.setValue({ bag: ['b'], currentId, shownAt: Date.now() })
}

/** What another tab writing to the shared state looks like from here. */
const anotherTabShows = (currentId: string) =>
  act(async () => {
    await photoState.setValue({ bag: ['c'], currentId, shownAt: Date.now() })
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
  vi.restoreAllMocks()
})

const deferred = <T,>() => {
  let resolve = (_value: T) => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

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
      // The first draw waits for the Background and Favourites storage reads too.
      // Each newly loaded storage item adds an async turn before the first photo is ready.
      for (let turn = 0; turn < 10 && result.current.photo?.id !== 'a'; turn++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0)
          await Promise.resolve()
        })
      }
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

  it('waits for both synced Backdrop items before watching or drawing a photo', async () => {
    await seed('a')
    const backgroundRead = deferred<Awaited<ReturnType<typeof backgroundItem.read>>>()
    const favouritesRead = deferred<Awaited<ReturnType<typeof favouritesItem.read>>>()
    vi.spyOn(backgroundItem, 'read').mockReturnValue(backgroundRead.promise)
    vi.spyOn(favouritesItem, 'read').mockReturnValue(favouritesRead.promise)
    const setPhotoState = vi.spyOn(photoState, 'setValue')
    const watchPhotoState = vi.spyOn(photoState, 'watch')
    const { result } = renderRotation(pinned('c'))

    await waitFor(() => {
      expect(backgroundItem.read).toHaveBeenCalled()
      expect(favouritesItem.read).toHaveBeenCalled()
    })
    expect(result.current.photo).toBeNull()
    expect(setPhotoState).not.toHaveBeenCalled()
    expect(watchPhotoState).not.toHaveBeenCalled()

    await act(async () => {
      backgroundRead.resolve({ newer: false, value: DEFAULT_BACKGROUND })
      await backgroundRead.promise
    })
    expect(setPhotoState).not.toHaveBeenCalled()
    expect(watchPhotoState).not.toHaveBeenCalled()

    await act(async () => {
      favouritesRead.resolve({ newer: false, value: DEFAULT_FAVOURITES })
      await favouritesRead.promise
    })
    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    expect(setPhotoState).toHaveBeenCalledTimes(1)
    expect(watchPhotoState).toHaveBeenCalledTimes(1)
  })

  it('waits for the stored settings before deciding anything', async () => {
    await seed()
    const { rerender, result } = renderRotation(null)

    // Settings haven't loaded yet: nothing decided, nothing written.
    await act(async () => {})
    expect(result.current.photo).toBeNull()
    expect((await photoState.getValue())?.currentId).toBe('a')

    rerender(cycle('daily'))

    // The stored setting says daily, so this tab shows the photo it was already on.
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('still shows a photo when the settings change while the manifest is fetched', async () => {
    // No cache, so the first visit waits on the network.
    let respond: (response: Response) => void = () => {}
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { rerender, result } = renderRotation(cycle('daily'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    // Any settings write hands the hook a new, equal object: here, mid-fetch.
    rerender(cycle('daily'))
    respond(
      new Response(JSON.stringify(makeManifest(IDS.map((id) => makePhoto(id)))), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    )

    await waitFor(() => expect(result.current.photo).not.toBeNull())
    expect(result.current.photos.map((photo) => photo.id)).toEqual(IDS)
  })

  it('does not move on when only the frequency changes', async () => {
    await seed()
    const { rerender, result } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    rerender(cycle('every-visit'))

    await act(async () => {})
    expect(result.current.photo?.id).toBe('a')
  })

  it('shows a pinned photo, in a new tab and when it is pinned later', async () => {
    await seed()
    const { rerender, result } = renderRotation(pinned('c'))
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

  it('moves to a photo with the tag when cycling it', async () => {
    await seed()
    const { rerender, result } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    rerender(cycle('daily', ['water']))

    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    let shown: string | null = null
    await act(async () => {
      shown = await result.current.next()
    })
    // Only c has the tag.
    expect(shown).toBe('c')
  })

  it('preloads the next photo with the tags, skipping ones queued before they changed', async () => {
    // c has the tag and stays up (daily); the bag holds b, queued before, which has none.
    await seed('c')
    const { result } = renderRotation(cycle('daily', ['water']))

    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    expect(result.current.upcoming).toBeNull()
  })

  it('preloads the photo that comes next', async () => {
    await seed()
    const { result } = renderRotation(cycle('daily'))

    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect(result.current.upcoming?.id).toBe('b')
  })

  it('keeps an unmarked current photo on screen and skips it on the next draw', async () => {
    await seed('a')
    await photoState.setValue({ bag: ['b', 'c'], currentId: 'a', shownAt: Date.now() })
    await backgroundItem.setValue({
      colour: '#ffffff',
      favouritesOnly: true,
      kind: 'photo',
      v: 1,
    })
    await favouritesItem.setValue({ ids: ['a', 'b', 'c'], v: 1 })
    const { result } = renderRotation(cycle('daily', ['water']))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))
    expect(result.current.upcoming?.id).toBe('b')

    await act(async () => favouritesItem.setValue({ ids: ['a', 'c'], v: 1 }))

    expect(result.current.photo?.id).toBe('a')
    expect(result.current.upcoming?.id).toBe('c')
    let shown: string | null = null
    await act(async () => {
      shown = await result.current.next()
    })
    expect(shown).toBe('c')
    expect(result.current.photo?.id).toBe('c')
  })

  it('preloads only favourite photos when Favourites only is on', async () => {
    await seed('c')
    await photoState.setValue({ bag: ['b', 'a'], currentId: 'c', shownAt: Date.now() })
    await backgroundItem.setValue({
      ...DEFAULT_BACKGROUND,
      favouritesOnly: true,
    })
    await favouritesItem.setValue({ ids: ['a', 'c'], v: 1 })
    const { result } = renderRotation(cycle('daily'))

    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    expect(result.current.upcoming?.id).toBe('a')
  })

  it('does not report gone favourites before the manifest has loaded', () => {
    const { result } = renderRotation(cycle('daily'))

    expect(result.current.photos).toEqual([])
    expect(result.current.favouritesGone).toBe(false)
  })

  it('moves into the favourites pool when Favourites only is turned on', async () => {
    await seed('a')
    await favouritesItem.setValue({ ids: ['c'], v: 1 })
    const { rerender, result } = renderRotation(cycle('daily'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    await act(async () =>
      backgroundItem.setValue({
        colour: '#ffffff',
        favouritesOnly: true,
        kind: 'photo',
        v: 1,
      }),
    )

    await waitFor(() => expect(result.current.photo?.id).toBe('c'))
    rerender(cycle('daily'))
    expect(result.current.photo?.id).toBe('c')
  })

  it('keeps a pinned photo and makes the next-photo button draw from favourites', async () => {
    await seed('a')
    await backgroundItem.setValue({
      colour: '#ffffff',
      favouritesOnly: true,
      kind: 'photo',
      v: 1,
    })
    await favouritesItem.setValue({ ids: ['c'], v: 1 })
    const { result } = renderRotation(pinned('a'))
    await waitFor(() => expect(result.current.photo?.id).toBe('a'))

    let shown: string | null = null
    await act(async () => {
      shown = await result.current.next()
    })

    expect(shown).toBe('c')
    expect(result.current.photo?.id).toBe('c')
  })
})
