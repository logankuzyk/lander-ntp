import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

/**
 * Something that must be true before a Widget can show anything, such as a chosen place. A
 * Widget lists its needs in order; this says only whether each is met, not what to tell people
 * about it or how to meet it.
 */
export type Need<O> = {
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
 * `needs` must be a stable array, such as one on a definition: a new array starts a new check.
 * The needs' `met` is called during render (inside `useMemo`), so it must only ask.
 *
 * Each Check is followed by one effect; a second effect on the same Check would never see an
 * answer.
 */
export function useUnmetNeed<O>(needs: readonly Need<O>[] | undefined, options: O): UnmetNeed<O> {
  const stableNeeds = needs ?? NO_NEEDS
  const stableOptions = useSameData(options)
  const current = useMemo(
    () => checkNeeds(stableNeeds, stableOptions),
    [stableNeeds, stableOptions],
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
