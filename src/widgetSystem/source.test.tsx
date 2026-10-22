import { render, screen } from '@testing-library/preact'
import { render as renderOutsideAct } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Query, type Reading, type ReadingCache, type Source, useSource } from './source'

const MAX_AGE_MS = 30 * 60 * 1000
const MAX_STALE_MS = 3 * 60 * 60 * 1000
const RETRY_MS = 60 * 1000

/** A cache kept in memory, one reading per key. */
function memoryCache() {
  const readings = new Map<string, Reading<number>>()
  const cache: ReadingCache<number> = {
    get: (key) => Promise.resolve(readings.get(key) ?? null),
    set: (key, reading) => {
      readings.set(key, reading)
      return Promise.resolve()
    },
  }
  return { cache, readings }
}

function makeSource(overrides: Partial<Source<number>> = {}) {
  const memory = memoryCache()
  const source: Source<number> = {
    cache: memory.cache,
    maxAgeMs: MAX_AGE_MS,
    maxStaleMs: MAX_STALE_MS,
    retryMs: RETRY_MS,
    ...overrides,
  }
  return { ...memory, source }
}

function Probe({ query, source }: { query: Query<number> | null; source: Source<number> }) {
  const reading = useSource(source, query)
  return <output>{reading === null ? 'none' : String(reading)}</output>
}

const shown = () => screen.getByRole('status').textContent

/** Lets pending promises, and timers due within `ms` from now, run. */
const pass = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

/** A fetch answering with each result in turn, then the last one for ever. */
const fetching = (...results: (number | null)[]) => {
  const queue = [...results]
  return vi.fn(() => Promise.resolve(queue.length > 1 ? queue.shift()! : (queue[0] ?? null)))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSource', () => {
  it('fetches nothing and shows nothing without a query, even with a reading cached', async () => {
    const { cache, source } = makeSource()
    await cache.set('a', { data: 5, fetchedAt: Date.now() })

    render(<Probe query={null} source={source} />)
    await pass(MAX_AGE_MS)

    expect(shown()).toBe('none')
  })

  it('fetches and caches the reading when nothing is cached', async () => {
    const { readings, source } = makeSource()
    const fetch = fetching(12)

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()

    expect(shown()).toBe('12')
    expect(readings.get('a')).toEqual({ data: 12, fetchedAt: Date.now() })
  })

  it('serves a fresh cache without asking again', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(12)
    await cache.set('a', { data: 5, fetchedAt: Date.now() })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()

    expect(shown()).toBe('5')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes a reading once it is older than the maximum age, and again each time that passes', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(12, 13)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - 10 * 60 * 1000 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass(MAX_AGE_MS - 10 * 60 * 1000 - 1)
    expect(fetch).not.toHaveBeenCalled()

    await pass(1)
    expect(shown()).toBe('12')

    await pass(MAX_AGE_MS)
    expect(shown()).toBe('13')
  })

  it('shows a stale cache, then the refreshed reading', async () => {
    const { cache, source } = makeSource()
    let answer: (data: number) => void = () => undefined
    const fetch = vi.fn(() => new Promise<number>((resolve) => (answer = resolve)))
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS - 1 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('5')

    answer(12)
    await pass()
    expect(shown()).toBe('12')
  })

  it('keeps a stale reading when the refresh fails, and tries again after the retry wait', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(null, 12)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS - 1 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(shown()).toBe('5')

    await pass(RETRY_MS - 1)
    expect(fetch).toHaveBeenCalledTimes(1)

    await pass(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(shown()).toBe('12')
  })

  it('drops a reading too old to show when the refresh fails', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(null)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_STALE_MS - 1 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()

    expect(fetch).toHaveBeenCalled()
    expect(shown()).toBe('none')
  })

  it('stops showing a kept reading once it has grown too old for the next failed refresh', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(null)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_STALE_MS + RETRY_MS * 2 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('5')

    await pass(RETRY_MS * 3)
    expect(shown()).toBe('none')
  })

  it('waits until the tab is looked at before asking', async () => {
    const { source } = makeSource()
    const fetch = fetching(12)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass(MAX_AGE_MS)
    expect(fetch).not.toHaveBeenCalled()

    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await pass()

    expect(shown()).toBe('12')
    hidden.mockRestore()
  })

  it('uses the reading another tab fetched in the meantime, not asking again', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(12)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS + 1000 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    // Another tab refreshes just before this one's turn.
    await pass(500)
    await cache.set('a', { data: 7, fetchedAt: Date.now() })
    await pass(500)

    expect(fetch).not.toHaveBeenCalled()
    expect(shown()).toBe('7')
  })

  it('shows nothing, cached or fetched, while switched off, and checks again after the maximum age', async () => {
    let on = false
    const { cache, source } = makeSource({ enabled: () => Promise.resolve(on) })
    const fetch = fetching(12)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS - 1 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass(MAX_AGE_MS - 1)
    expect(shown()).toBe('none')
    expect(fetch).not.toHaveBeenCalled()

    on = true
    await pass(1)
    expect(shown()).toBe('12')
  })

  it('hides a reading it was showing when it is switched off', async () => {
    let on = true
    const { cache, source } = makeSource({ enabled: () => Promise.resolve(on) })
    const fetch = fetching(12)
    await cache.set('a', { data: 5, fetchedAt: Date.now() })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('5')

    on = false
    await pass(MAX_AGE_MS)
    expect(shown()).toBe('none')
  })

  it('ignores a reading cached for another key', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(54)
    await cache.set('b', { data: 5, fetchedAt: Date.now() })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()

    expect(shown()).toBe('54')
  })

  it('does not fetch the new key for, or cache it under, the old key when the key changes mid-check', async () => {
    const { cache, readings, source } = makeSource()
    // The first read of the cache is held until released.
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    let held = false
    source.cache = {
      ...cache,
      get: async (key) => {
        if (!held) {
          held = true
          await gate
        }
        return cache.get(key)
      },
    }
    const fetchA = fetching(1)
    const fetchB = fetching(2)
    const container = document.createElement('div')
    document.body.append(container)

    try {
      renderOutsideAct(<Probe query={{ fetch: fetchA, key: 'a' }} source={source} />, container)
      await pass(200)
      // Outside `act`, the old effect is cleaned up only after a paint; its check is still reading.
      renderOutsideAct(<Probe query={{ fetch: fetchB, key: 'b' }} source={source} />, container)
      release()
      await pass()

      expect(readings.has('a')).toBe(false)
      expect(fetchA).not.toHaveBeenCalled()
      await pass(200)
      expect(readings.get('b')?.data).toBe(2)
    } finally {
      renderOutsideAct(null, container)
      container.remove()
    }
  })

  it('drops a reading too old to show while its refresh is still pending', async () => {
    const { cache, source } = makeSource()
    const fetch = vi.fn(() => new Promise<number>(() => undefined))
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_STALE_MS - 1 })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()

    expect(fetch).toHaveBeenCalled()
    expect(shown()).toBe('none')
  })

  it('stops everything when unmounted: no timer left, no listener, nothing fetched later', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(12)
    const remove = vi.spyOn(document, 'removeEventListener')
    await cache.set('a', { data: 5, fetchedAt: Date.now() })

    const view = render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

    await pass(MAX_AGE_MS)
    document.dispatchEvent(new Event('visibilitychange'))
    await pass()
    expect(fetch).not.toHaveBeenCalled()
    remove.mockRestore()
  })

  it('does nothing more when unmounted while the cache is being read', async () => {
    const { cache, source } = makeSource()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    source.cache = { ...cache, get: async (key) => (await gate, cache.get(key)) }
    const fetch = fetching(12)

    const view = render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    view.unmount()
    release()
    await pass(MAX_AGE_MS)

    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a second fetch while one is in flight', async () => {
    const { source } = makeSource()
    const fetch = vi.fn(() => new Promise<number>(() => undefined))

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    document.dispatchEvent(new Event('visibilitychange'))
    await pass()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('checks a switched-off source again after exactly the maximum age', async () => {
    const enabled = vi.fn(() => Promise.resolve(false))
    // A maximum age that is not a multiple of the retry wait, so the two cannot be mistaken.
    const { source } = makeSource({ enabled, maxAgeMs: 100_000, retryMs: 60_000 })

    render(<Probe query={{ fetch: fetching(12), key: 'a' }} source={source} />)
    await pass()
    expect(enabled).toHaveBeenCalledTimes(1)

    await pass(99_999)
    expect(enabled).toHaveBeenCalledTimes(1)

    await pass(1)
    expect(enabled).toHaveBeenCalledTimes(2)
  })

  it('lets a check made when the tab comes back replace the wait that was pending', async () => {
    const { cache, source } = makeSource()
    const fetch = fetching(null)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - (MAX_AGE_MS - 100_000) })

    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    // Fresh, so the next check is due in 100 seconds.
    await pass(90_000)
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS - 1 })

    document.dispatchEvent(new Event('visibilitychange'))
    await pass()
    expect(fetch).toHaveBeenCalledTimes(1)

    // The earlier wait would have ended 10 seconds in; the failed fetch's retry is 60 seconds out.
    await pass(20_000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('never shows the reading for one key as the reading for another', async () => {
    const { cache, source } = makeSource()
    const slow = vi.fn(() => new Promise<number>(() => undefined))
    await cache.set('a', { data: 5, fetchedAt: Date.now() })

    const view = render(<Probe query={{ fetch: fetching(1), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('5')

    view.rerender(<Probe query={{ fetch: slow, key: 'b' }} source={source} />)
    await pass()
    expect(shown()).toBe('none')

    view.rerender(<Probe query={null} source={source} />)
    await pass()
    expect(shown()).toBe('none')
  })
})
