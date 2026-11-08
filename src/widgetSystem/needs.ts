import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { browser } from 'wxt/browser'

/**
 * What pressing a Widget's setup button does about an unmet need.
 *
 * - `option`: opens the Widget's options at the option that is missing (the Weather's place).
 * - `ask`: asks the browser (a permission, Firefox's consent). `run` is the first thing the
 *   click handler calls, before anything is awaited, because Firefox only shows its prompt from
 *   a click's own call. It may give a promise; when that settles the needs are asked again.
 */
export type NeedAction = { kind: 'ask'; run: () => unknown } | { kind: 'option'; option: string }

/** What a Need says to people: the words on the setup button, and what it does. Both or neither. */
type NeedSetup = { action: NeedAction; label: string } | { action?: undefined; label?: undefined }

/**
 * Something that must be true before a Widget can show anything, such as a chosen place. A
 * Widget lists its needs in order. A need says whether it is met and, if it has words and an
 * action, how a person meets it: the setup button draws them while it is the first need unmet.
 * A need with neither draws nothing while unmet.
 */
export type Need<O> = NeedSetup & {
  /** Stable, and unique among the Widget's needs. */
  id: string
  /**
   * Whether the need is met for these options. Answer at once (`true` or `false`) when you can:
   * a Widget whose needs all do is drawn in its first render. A need that throws, whose
   * answer fails, or whose answer is anything but `true` is counted as unmet.
   *
   * It is called while the Widget is drawn (inside `useMemo`), and again for each change of
   * options, so it must do nothing but ask: no side effects, and nothing slow before returning
   * the promise.
   */
  met: (options: O) => boolean | Promise<boolean>
}

/** What `useUnmetNeed` gives while it is still waiting for an answer. */
export const CHECKING = 'checking'

/** Still checking, the first need that is unmet, or null: every need is met. */
export type UnmetNeed<O> = Need<O> | typeof CHECKING | null

const NO_NEEDS: readonly never[] = []

/** One check of the needs for one set of options. */
type Check<O> = {
  /**
   * Ends the check: it asks no more needs and never gives an answer, not even "every need is
   * met", which would show the Widget with a need unmet.
   */
  cancel: () => void
  /** The answer when it comes, if it did not come at once. Never, once cancelled. */
  later: Promise<Need<O> | null> | undefined
  /** The answer, if every need asked so far was answered at once. Undefined: still waiting. */
  now: Need<O> | null | undefined
}

/** Whether a value is a promise, or something that acts as one. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/**
 * Asks the needs in order, stopping at the first unmet one. Answers given at once are used at
 * once; from the first late answer on, the rest follows when it arrives. An answer that is not
 * `true` (or a promise of it) leaves the need unmet.
 *
 * Exported for its tests; the hook below is how Widgets use it.
 */
export function checkNeeds<O>(needs: readonly Need<O>[], options: O): Check<O> {
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  /** Asks `needs[from]` onwards while the answers keep coming at once. */
  const ask = (
    from: number,
  ): { index: number; pending: Promise<unknown> } | { now: Need<O> | null } => {
    for (let i = from; i < needs.length; i++) {
      const need = needs[i]!
      let answer: unknown
      try {
        answer = need.met(options)
      } catch {
        return { now: need }
      }
      if (isThenable(answer)) return { index: i, pending: Promise.resolve(answer) }
      if (answer !== true) return { now: need }
    }
    return { now: null }
  }

  const first = ask(0)
  if ('now' in first) return { cancel, later: undefined, now: first.now }

  const finish = async (index: number, pending: Promise<unknown>): Promise<Need<O> | null> => {
    for (;;) {
      const met = await pending.then(
        (answer) => answer === true,
        () => false,
      )
      // The options have changed since: do not ask the rest about them, and do not answer.
      if (cancelled) return new Promise<never>(() => {})
      if (!met) return needs[index]!
      const next = ask(index + 1)
      if ('now' in next) return next.now
      index = next.index
      pending = next.pending
    }
  }
  return { cancel, later: finish(first.index, first.pending), now: undefined }
}

/** Whether two values hold the same data: options are plain data, so this reads through objects and arrays. */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

/** The value from the last render if it holds the same data, so it can be a dependency. */
function useSameData<T>(value: T): T {
  const kept = useRef(value)
  if (!sameData(kept.current, value)) kept.current = value
  return kept.current
}

/**
 * Whether a Widget's needs are met for its options: `'checking'` while an answer is awaited,
 * the first need that is unmet, or null when every need is met.
 *
 * The needs are asked in order, once on mount and again whenever the options change (by what
 * they hold, not by identity). An answer given at once is settled in the same render, so a
 * Widget whose needs all answer at once is never `'checking'`. An answer that comes late for
 * options that have since changed is ignored.
 *
 * `recheck` is a count: asking again with the options unchanged (a permission was just granted)
 * is a change of count.
 *
 * `needs` must be a stable array, such as one on a definition: a new array starts a new check.
 * The needs' `met` is called during render (inside `useMemo`), so it must only ask.
 *
 * Each Check is followed by one effect; a second effect on the same Check would never see an
 * answer.
 */
export function useUnmetNeed<O>(
  needs: readonly Need<O>[] | undefined,
  options: O,
  recheck = 0,
): UnmetNeed<O> {
  const stableNeeds = needs ?? NO_NEEDS
  const stableOptions = useSameData(options)
  const current = useMemo(
    () => checkNeeds(stableNeeds, stableOptions),
    // `recheck` is not read: a new count is a reason to ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableNeeds, stableOptions, recheck],
  )
  const [settled, setSettled] = useState<{ check: Check<O>; unmet: Need<O> | null } | null>(null)

  useEffect(() => {
    const { later } = current
    if (!later) return
    let active = true
    void later.then((unmet) => {
      if (active) setSettled({ check: current, unmet })
    })
    return () => {
      active = false
      current.cancel()
    }
  }, [current])

  if (current.now !== undefined) return current.now
  // The answer to an earlier check, for other options, is not this one's.
  return settled?.check === current ? settled.unmet : CHECKING
}

/**
 * Asks `recheck` to run when the browser's permissions may have changed: one was added or
 * removed (an extension permission, Firefox's data agreement), or the geolocation permission
 * changed state (granted or revoked from the address bar, or the site settings). Returns what
 * stops it. Every part is allowed to be missing: a browser without one of these events, or a
 * page that cannot ask, is simply not told.
 */
function watchPermissions(recheck: () => void): () => void {
  const stops: (() => void)[] = []
  for (const event of [browser.permissions?.onAdded, browser.permissions?.onRemoved]) {
    try {
      event.addListener(recheck)
      stops.push(() => event.removeListener(recheck))
    } catch {
      // No such event here.
    }
  }

  let active = true
  void (async () => {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      if (!active) return
      status.addEventListener('change', recheck)
      stops.push(() => status.removeEventListener('change', recheck))
    } catch {
      // Not a page that can ask.
    }
  })()

  return () => {
    active = false
    for (const stop of stops) {
      try {
        stop()
      } catch {
        // Already gone.
      }
    }
  }
}

/** The rechecks of every Widget and form that is watching, to be called together. */
const watching = new Set<() => void>()

/**
 * Asks every watching Widget and form to check its needs again: something that meets a need
 * from one place (the button in an options form) has to tell the others (the Widget's own setup
 * button) without waiting for the browser to say a permission changed, which not every browser
 * does for every permission.
 */
export function recheckAll(): void {
  for (const recheck of [...watching]) recheck()
}

/**
 * The count `useUnmetNeed` takes as its `recheck`, and the function that adds one to it: asking
 * the needs again when something outside the options changed (a permission was granted or
 * revoked). The function is the same on every render, so a listener can hold it. The setup
 * button's `ask` actions call it when the browser has answered.
 *
 * With `watch`, it is also called when the tab comes back into view and when a permission
 * changes (see `watchPermissions`), so a grant given or taken back elsewhere, in the address bar
 * or the browser's settings, shows up without a reload. A Widget with no needs has nothing to
 * watch and leaves `watch` off.
 */
export function useRecheck(watch = false): [count: number, recheck: () => void] {
  const [count, setCount] = useState(0)
  const recheck = useCallback(() => setCount((current) => current + 1), [])

  useEffect(() => {
    if (!watch) return
    watching.add(recheck)
    const onVisibility = () => {
      if (!document.hidden) recheck()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const stopWatching = watchPermissions(recheck)
    return () => {
      watching.delete(recheck)
      document.removeEventListener('visibilitychange', onVisibility)
      stopWatching()
    }
  }, [watch, recheck])

  return [count, recheck]
}

/**
 * Runs a need's `ask` action for a button: `run` is called at once, as the first thing the click
 * does and with nothing awaited before it, since Firefox shows its prompt only from a click's own
 * call. While it is waiting a second press does nothing. When it settles, whatever it gave,
 * `onAsked` is called so the needs are asked again; if it threw or its promise rejected they are
 * not, and the button can be pressed again. The function is the same on every render.
 */
export function useAsk(onAsked: () => void): (run: () => unknown) => void {
  // Not state: a second press in the same moment must see it, before any render.
  const asking = useRef(false)
  const answered = useRef(onAsked)
  answered.current = onAsked
  return useCallback((run) => {
    if (asking.current) return
    asking.current = true
    void (async () => {
      try {
        await run()
      } catch {
        return
      } finally {
        asking.current = false
      }
      answered.current()
    })()
  }, [])
}
