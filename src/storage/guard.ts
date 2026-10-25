import { storage } from 'wxt/utils/storage'

/**
 * A synced item carries a version `v`, and a device never saves over one with a higher `v` than
 * it knows: the device that wrote it may have put things there this one would drop. See
 * AGENTS.md on stored settings.
 */

/** A save was refused because what is stored was written by a newer version of the page. */
export class NewerVersionError extends Error {
  constructor(key: string) {
    super(`${key} was written by a newer version, so it is not saved over`)
    this.name = 'NewerVersionError'
  }
}

/**
 * The version a stored value says it has. A value with no `v` is version 1: what v0.2.3 wrote
 * has none. Any `v` that is not a whole number of at least 1 is unreadable.
 */
export function versionOf(raw: unknown): 'unreadable' | number {
  if (typeof raw !== 'object' || raw === null || !('v' in raw)) return 1
  const { v } = raw
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 'unreadable'
}

/** What is stored, as the page draws it, and whether a newer version wrote it. */
export type GuardedRead<T> = { newer: boolean; value: T }

export type GuardedItem<T> = {
  fallback: T
  key: `sync:${string}`
  /** The stored value checked into `T` (the fallback when there is none), and whether it is newer. */
  read: () => Promise<GuardedRead<T>>
  /** Called with what is stored each time it changes, or null when it is removed. */
  watch: (callback: (read: GuardedRead<T> | null) => void) => () => void
  /**
   * Writes `value`, unless what is stored right now is newer: then it throws a
   * `NewerVersionError` and writes nothing. It looks at what is stored when it writes, not when
   * the page last read, so a newer value that arrived by sync in between is still protected.
   */
  write: (value: T) => Promise<void>
}

type GuardedItemOptions<T> = {
  /** Makes the stored value into a `T`. It is also given a newer version's value, which it must only read. */
  check: (raw: unknown) => T
  fallback: T
  key: `sync:${string}`
  /** The version this code knows. */
  version: number
}

/**
 * WXT's storage item behind the version guard. WXT's own `version` and `migrations` are not used:
 * nothing is migrated, and the version lives in the value, where every device can see it.
 */
export function defineGuardedItem<T>({
  check,
  fallback,
  key,
  version,
}: GuardedItemOptions<T>): GuardedItem<T> {
  // The raw value, unchecked: the guard needs the version as stored, not as the check reads it.
  const raw = storage.defineItem<unknown>(key, { fallback: null })

  const newerThanKnown = (stored: unknown) => {
    const found = versionOf(stored)
    return found === 'unreadable' || found > version
  }
  const readOf = (stored: unknown): GuardedRead<T> => ({
    newer: newerThanKnown(stored),
    value: stored === null ? fallback : check(stored),
  })

  return {
    fallback,
    key,
    read: async () => readOf(await raw.getValue()),
    watch: (callback) => raw.watch((stored) => callback(stored === null ? null : readOf(stored))),
    write: async (value) => {
      if (newerThanKnown(await raw.getValue())) throw new NewerVersionError(key)
      await raw.setValue(value)
    },
  }
}
