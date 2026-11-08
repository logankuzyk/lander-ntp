import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

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

/**
 * Where a source stands for the key it was asked for. `ready` has a reading to show; `loading`
 * has none yet (nothing is cached, or there is no query); `failed` has none, because the fetch
 * failed and nothing cached is recent enough to show; `off` is switched off, and shows nothing.
 */
export type SourceStatus = 'failed' | 'loading' | 'off' | 'ready'

/** A reading to show if there is one, and where the source stands. `reading` is set only when `ready`. */
export type SourceState<R> = { reading: R | null; status: SourceStatus }

const needResultTag: unique symbol = Symbol('NeedResult')

/** A tagged result that tells the Widget to show one of its Needs. */
export type NeedResult = { name: string; readonly [needResultTag]: true }

/** Reports a Need from a watched read without colliding with an ordinary object reading. */
export const reportNeed = (name: string): NeedResult => ({ name, [needResultTag]: true })

function isNeedResult(value: unknown): value is NeedResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    needResultTag in value &&
    value[needResultTag] === true
  )
}

/** A local source that reads again when its underlying data changes. */
export type WatchedSource<R, O> = {
  kind: 'watched'
  read: (options: O) => Promise<NeedResult | R>
  /** Calls `onChange` when the data may have changed; returns the function that stops. */
  watch: (onChange: () => void) => () => void
}

export type WatchedSourceState<R> = {
  need?: string
  reading: R | null
  refresh: () => void
  status: 'needs' | SourceStatus
}

/** The delay that combines a burst of source changes into one read. */
export const WATCH_DEBOUNCE_MS = 100

function sameOptions(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const left = Object.keys(a)
  const right = Object.keys(b)
  return (
    left.length === right.length &&
    left.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameOptions((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** Reads a watched source on mount and after changes, without storing or timing its readings. */
export function useWatchedSourceState<R, O>(
  source: WatchedSource<R, O>,
  options: O,
): WatchedSourceState<R> {
  const stable = useRef(options)
  if (!sameOptions(stable.current, options)) stable.current = options
  const currentOptions = stable.current
  const generation = useRef(currentOptions)
  const optionsChanged = generation.current !== currentOptions
  generation.current = currentOptions
  const [state, setState] = useState<Omit<WatchedSourceState<R>, 'refresh'>>({
    reading: null,
    status: 'loading',
  })
  const reload = useRef<() => void>(() => undefined)
  const refresh = useCallback(() => reload.current(), [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let queued = false
    let failed = false
    setState({ reading: null, status: 'loading' })
    const read = async () => {
      if (!active) return
      if (running) {
        queued = true
        return
      }
      running = true
      setState((old) => ({
        need: undefined,
        reading: old.reading,
        status: old.reading === null ? 'loading' : 'ready',
      }))
      try {
        const result = await source.read(currentOptions)
        if (!active) return
        failed = false
        if (isNeedResult(result)) {
          setState((old) => ({
            need: result.name,
            reading: old.reading,
            status: 'needs',
          }))
        } else {
          setState({ reading: result as R, status: 'ready' })
        }
      } catch {
        if (active) {
          failed = true
          setState((old) => ({ reading: old.reading, status: 'failed' }))
        }
      } finally {
        running = false
        if (active && queued) {
          queued = false
          schedule()
        }
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void read(), WATCH_DEBOUNCE_MS)
    }
    reload.current = () => void read()
    const stop = source.watch(schedule)
    const onVisibility = () => {
      if (!document.hidden && failed) schedule()
    }
    document.addEventListener('visibilitychange', onVisibility)
    void read()
    return () => {
      active = false
      clearTimeout(timer)
      reload.current = () => undefined
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [source, currentOptions])

  return optionsChanged ? { reading: null, refresh, status: 'loading' } : { ...state, refresh }
}

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
    // A fetch that throws, or rejects, has failed just as one that gives nothing has.
    let data: R | null
    try {
      data = await fetch()
    } catch {
      data = null
    }
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
 * is switched off, or nothing recent enough is cached and the network is unavailable. See
 * `useSourceState` for which of those it is.
 */
export function useSource<R>(source: Source<R>, query: Query<R> | null): R | null {
  return useSourceState(source, query).reading
}

/**
 * The reading for the query and where the source stands: `ready` with a reading, or without
 * one `loading`, `failed` (the fetch failed and nothing recent enough is cached) or `off`
 * (switched off). A failure is remembered for its key only: a new key starts as `loading`, and
 * a failure stays `failed` through the retries until one succeeds.
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
export function useSourceState<R>(source: Source<R>, query: Query<R> | null): SourceState<R> {
  const key = query?.key ?? null
  const [shown, setShown] = useState<(Reading<R> & { key: string }) | null>(null)
  // Why there is nothing to show, for a key: only `failed` and `off` are known; no reason is loading.
  const [problem, setProblem] = useState<{ key: string; status: 'failed' | 'off' } | null>(null)
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
          setProblem({ key, status: 'off' })
          return again(source.maxAgeMs)
        }
        // Back on: that it was off is over. A failure stays until a fetch settles it.
        setProblem((old) => (old?.status === 'off' ? null : old))
        const age = cached ? Date.now() - cached.fetchedAt : Infinity
        if (cached && age < source.maxStaleMs) setShown({ ...cached, key })
        if (age < source.maxAgeMs) return again(source.maxAgeMs - age)

        // The key may have changed while the cache was read; this check is then not the one to fetch.
        const current = latest.current
        if (current?.key !== key) return
        const reading = await fetchOnce(source.cache, key, current.fetch)
        if (!active) return
        setProblem(reading ? null : { key, status: 'failed' })
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

  // A reading for the last key is not this key's, nor is its failure.
  if (shown && shown.key === key) return { reading: shown.data, status: 'ready' }
  return { reading: null, status: problem?.key === key ? problem.status : 'loading' }
}
