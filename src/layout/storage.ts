import { defineGuardedItem } from '@/storage/guard'

import { checkLayout, isLayoutReadable, storedLayout } from './check'
import type { Layout } from './types'

/** The version of the Layout this code knows. */
const LAYOUT_VERSION = 1

// A Layout of a newer version is read for what it shows and never written over (see the guard).
// So is a value with no shape to read: nothing in it can be told, and nothing may be lost.
// There is no Layout until the first change: then the fallback is null, and the page works one
// out from the settings (a later change).
const guarded = defineGuardedItem<Layout | null>({
  check: (raw) => checkLayout(raw),
  fallback: null,
  key: 'sync:layout',
  serialize: (layout) => {
    if (layout === null) throw new TypeError('There is no Layout to store')
    return storedLayout(layout)
  },
  unreadable: (raw) => !isLayoutReadable(raw),
  version: LAYOUT_VERSION,
})

/**
 * The Layout, synced by the browser so that it is the same on every device. One item for the
 * whole Layout, so every save is atomic. v0.2.3 never reads it. It is read as a `Layout`, with
 * everything this version does not understand kept, and stored as the `StoredLayout` that makes.
 */
export const layoutItem = {
  fallback: null as Layout | null,
  getValue: async (): Promise<Layout | null> => (await guarded.read()).value,
  key: guarded.key,
  /** The Layout, and whether a newer version wrote it, which makes it read-only. */
  read: guarded.read,
  /**
   * Throws a `NewerVersionError`, writing nothing, when the stored Layout is newer or cannot be
   * read.
   */
  setValue: (value: Layout | null): Promise<void> => guarded.write(value),
  watch: (callback: (value: Layout | null, newer?: boolean) => void): (() => void) =>
    guarded.watch((read) => (read ? callback(read.value, read.newer) : callback(null))),
}
