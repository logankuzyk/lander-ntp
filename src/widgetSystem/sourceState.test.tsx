import { render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type Query, type Reading, type ReadingCache, type Source, useSourceState } from './source'

const MAX_AGE_MS = 30 * 60 * 1000
const MAX_STALE_MS = 3 * 60 * 60 * 1000
const RETRY_MS = 60 * 1000

/** A cache kept in memory, one reading per key. */
function makeSource(overrides: Partial<Source<number>> = {}) {
  const readings = new Map<string, Reading<number>>()
  const cache: ReadingCache<number> = {
    get: (key) => Promise.resolve(readings.get(key) ?? null),
    set: (key, reading) => {
      readings.set(key, reading)
      return Promise.resolve()
    },
  }
  const source: Source<number> = {
    cache,
    maxAgeMs: MAX_AGE_MS,
    maxStaleMs: MAX_STALE_MS,
    retryMs: RETRY_MS,
    ...overrides,
  }
  return { cache, readings, source }
}

function Probe({ query, source }: { query: Query<number> | null; source: Source<number> }) {
  const { reading, status } = useSourceState(source, query)
  return <output>{`${status} ${reading === null ? 'none' : reading}`}</output>
}

const shown = () => screen.getByRole('status').textContent

/** Lets pending promises, and timers due within `ms` from now, run. */
const pass = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

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

describe('useSourceState', () => {
  it('is loading, with no reading, until the first check has an answer', async () => {
    const { source } = makeSource()
    const fetch = vi.fn(() => new Promise<number>(() => undefined))
    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    expect(shown()).toBe('loading none')

    await pass()

    expect(fetch).toHaveBeenCalled()
    expect(shown()).toBe('loading none')
  })

  it('is loading, not failed, while there is no query to load yet', async () => {
    const { source } = makeSource()
    render(<Probe query={null} source={source} />)
    await pass()
    expect(shown()).toBe('loading none')
  })

  it('is ready with a fresh cached reading, with no loading before it', async () => {
    const { cache, source } = makeSource()
    await cache.set('a', { data: 5, fetchedAt: Date.now() })
    const fetch = fetching(12)
    render(<Probe query={{ fetch, key: 'a' }} source={source} />)

    await pass()

    expect(shown()).toBe('ready 5')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('is ready with a fetched reading', async () => {
    const { source } = makeSource()
    render(<Probe query={{ fetch: fetching(12), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('ready 12')
  })

  it('is ready with a stale reading while it refreshes, and after the refresh fails', async () => {
    const { cache, source } = makeSource()
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_AGE_MS - 1 })
    render(<Probe query={{ fetch: fetching(null), key: 'a' }} source={source} />)

    await pass()

    expect(shown()).toBe('ready 5')
  })

  it('is failed when the fetch fails and there is no reading to show', async () => {
    const { source } = makeSource()
    render(<Probe query={{ fetch: fetching(null), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('failed none')
  })

  it('is failed, not ready, when the only reading cached is too old to show', async () => {
    const { cache, source } = makeSource()
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_STALE_MS - 1 })
    render(<Probe query={{ fetch: fetching(null), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('failed none')
  })

  it('stays failed through the retry fetch, and is ready once a retry succeeds', async () => {
    const { source } = makeSource()
    let answer!: (data: number) => void
    const fetch = vi
      .fn<() => Promise<number | null>>()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise<number>((resolve) => (answer = resolve)))
    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('failed none')

    await pass(RETRY_MS)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(shown()).toBe('failed none')

    answer(9)
    await pass()
    expect(shown()).toBe('ready 9')
  })

  it('goes from ready to failed once a kept reading grows too old for a failing refresh', async () => {
    const { cache, source } = makeSource()
    await cache.set('a', { data: 5, fetchedAt: Date.now() - MAX_STALE_MS + RETRY_MS * 2 })
    render(<Probe query={{ fetch: fetching(null), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('ready 5')

    await pass(RETRY_MS * 3)

    expect(shown()).toBe('failed none')
  })

  it('is off when the source is switched off, even with a reading cached', async () => {
    const { cache, source } = makeSource({ enabled: () => Promise.resolve(false) })
    await cache.set('a', { data: 5, fetchedAt: Date.now() })
    const fetch = fetching(12)
    render(<Probe query={{ fetch, key: 'a' }} source={source} />)

    await pass()

    expect(shown()).toBe('off none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('is off for a reading it was showing when it is switched off, and loads again when switched on', async () => {
    let enabled = true
    const { readings, source } = makeSource({ enabled: () => Promise.resolve(enabled) })
    const fetch = fetching(12)
    render(<Probe query={{ fetch, key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('ready 12')

    enabled = false
    await pass(MAX_AGE_MS)
    expect(shown()).toBe('off none')

    enabled = true
    readings.clear()
    fetch.mockImplementation(() => new Promise<number>(() => undefined))
    await pass(MAX_AGE_MS)
    expect(shown()).toBe('loading none')
  })

  it('does not carry one key’s failure over to the next key: it is loading', async () => {
    const { source } = makeSource()
    const view = render(<Probe query={{ fetch: fetching(null), key: 'a' }} source={source} />)
    await pass()
    expect(shown()).toBe('failed none')

    const pending = vi.fn(() => new Promise<number>(() => undefined))
    view.rerender(<Probe query={{ fetch: pending, key: 'b' }} source={source} />)
    await pass()

    expect(pending).toHaveBeenCalled()
    expect(shown()).toBe('loading none')
  })
})
