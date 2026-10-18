import { render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Reading, type ReadingCache, type Source, useSource } from './source'

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

type Query = { fetch: () => Promise<number | null>; key: string } | null

function Probe({ query, source }: { query: Query; source: Source<number> }) {
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
