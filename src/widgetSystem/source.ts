import { useEffect, useRef, useState } from 'preact/hooks'

/** A reading and when it was fetched. */
export type Reading<R> = {
  data: R
  /** Epoch ms of the fetch. */
  fetchedAt: number
}

/** Where a source keeps its readings between tabs, by the key they were asked for. */
export type ReadingCache<R> = {
  /** The reading kept for this key, or null if there is none. Never one for another key. */
  get: (key: string) => Promise<Reading<R> | null>
  set: (key: string, reading: Reading<R>) => Promise<void>
  /**
   * Calls back with the key's new reading (null if it was forgotten) whenever it changes in
   * storage, such as when another tab fetches it. Returns a function that stops. A cache that
   * cannot tell leaves this out, and is only read when a check is due.
   */
  watch?: (key: string, onChange: (reading: Reading<R> | null) => void) => () => void
}

/**
 * Where a widget's data comes from, and how long it is good for. One shared loader, `useSource`,
 * fetches, caches and refreshes every source.
 */
export type Source<R> = {
  cache: ReadingCache<R>
  /**
   * Whether the source may be used at all, asked before each check. When it says no, nothing
   * is shown, not even a cached reading, which would never refresh.
   */
  enabled?: () => Promise<boolean>
  /** How long a reading is served before asking again. */
  maxAgeMs: number
  /** How old a reading can be and still be shown, when every refresh fails. */
  maxStaleMs: number
  /** How soon to ask again after a refresh that failed, which may only mean the network was away. */
  retryMs: number
}

/** What to load: the key a reading is cached under, and how to get a new one (null if it failed). */
export type Query<R> = { fetch: () => Promise<R | null>; key: string }

/** The fetches under way in this tab, by cache and then key. */
const inFlight = new WeakMap<object, Map<string, Promise<Reading<unknown> | null>>>()

/**
 * Fetches a new reading and keeps it, unless one is already being fetched for the key, in which
 * case that fetch is waited for instead: two widgets on one key make one request and share its
 * reading. Null if the fetch failed. The reading is in the cache by the time this resolves.
 */
function fetchOnce<R>(
  cache: ReadingCache<R>,
  key: string,
  fetch: () => Promise<R | null>,
): Promise<Reading<R> | null> {
  let byKey = inFlight.get(cache)
  if (!byKey) inFlight.set(cache, (byKey = new Map()))
  const started = byKey.get(key) as Promise<Reading<R> | null> | undefined
  if (started) return started

  const requests = byKey
  const request = (async () => {
    const data = await fetch()
    if (data == null) return null
    const reading = { data, fetchedAt: Date.now() }
    await cache.set(key, reading)
    return reading
  })().finally(() => requests.delete(key))
  requests.set(key, request as Promise<Reading<unknown> | null>)
  return request
}

/**
 * The reading for the query, or null while there is none to show: there is no query, the source
 * is switched off, or nothing recent enough is cached and the network is unavailable.
 *
 * Stale-while-revalidate, like the photo manifest: a cached reading for this key is shown
 * straight away and refreshed once older than `maxAgeMs`, and again each time that passes
 * while the tab stays open and in view. A failed refresh keeps the old reading until it is
 * older than `maxStaleMs`, and is tried again after `retryMs`.
 *
 * Readings are shared. Every use of a source with the same key waits for one fetch, in this
 * tab, and a reading another tab writes is picked up (if the cache can say so) instead of
 * being fetched again.
 *
 * `source` must be a stable object, such as one defined at module level: the loader starts over
 * whenever it, or the query's key, changes.
 */
export function useSource<R>(source: Source<R>, query: Query<R> | null): R | null {
  const key = query?.key ?? null
  const [shown, setShown] = useState<(Reading<R> & { key: string }) | null>(null)
  // The effect below runs once per key; the fetch it calls is whichever the latest render gave.
  const latest = useRef(query)
  latest.current = query

  useEffect(() => {
    if (key === null) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    let checking = false

    /** Check again after a wait; the source and the cache are both read anew each time. */
    const again = (wait: number) => {
      timer = setTimeout(() => void check(), wait)
    }

    const check = async () => {
      // Every open tab runs this. One nobody is looking at waits until it is looked at, and the
      // cache is read first, so a reading another tab has just fetched is not fetched again.
      if (checking || document.hidden) return
      checking = true
      clearTimeout(timer)
      try {
        const [enabled, cached] = await Promise.all([
          source.enabled ? source.enabled() : true,
          source.cache.get(key),
        ])
        if (!active) return
        // Switched off: not even the cached reading, which would never refresh.
        if (!enabled) {
          setShown(null)
          return again(source.maxAgeMs)
        }
        const age = cached ? Date.now() - cached.fetchedAt : Infinity
        if (cached && age < source.maxStaleMs) setShown({ ...cached, key })
        if (age < source.maxAgeMs) return again(source.maxAgeMs - age)

        // The key may have changed while the cache was read; this check is then not the one to fetch.
        const current = latest.current
        if (current?.key !== key) return
        const reading = await fetchOnce(source.cache, key, current.fetch)
        if (!active) return
        setShown((old) =>
          reading
            ? { ...reading, key }
            : old && Date.now() - old.fetchedAt < source.maxStaleMs
              ? old
              : null,
        )
        again(reading ? source.maxAgeMs : source.retryMs)
      } finally {
        checking = false
      }
    }

    const onVisibilityChange = () => void check()
    document.addEventListener('visibilitychange', onVisibilityChange)
    // A check reads the cache first, so a reading just written, even by this use, is not fetched
    // again. A reading forgotten is not one to fetch at once: the next check, when due, does that.
    const unwatch = source.cache.watch?.(key, (written) => {
      if (written) void check()
    })
    void check()

    return () => {
      active = false
      unwatch?.()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [source, key])

  // A reading for the last key is not this key's.
  return shown && shown.key === key ? shown.data : null
}
