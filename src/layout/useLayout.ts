import { useCallback } from 'preact/hooks'

import { type StorageItemOptions, useStorageItem } from '@/settings/useStorageItem'

import { layoutItem } from './storage'
import type { Layout } from './types'

/**
 * The Layout, and how to change it. No UI: it only stores and reads.
 *
 * - `layout` is null until one is stored; `loaded` is true once the stored value has arrived.
 * - `readOnly` is true while a newer version of the page wrote the Layout (or it has no shape
 *   to read). Nothing is saved then.
 * - `commit(next)` shows the whole Layout at once and saves it in one write, stamped `v: 1`.
 *   Saves go one at a time with only the latest waiting (twenty commits are two writes). When
 *   the browser rejects the write the stored Layout is put back and `onRejected` is called, so
 *   the page can say so. It does nothing while read-only.
 *
 * Call `commit` only once `loaded` is true. Before the stored Layout has arrived `readOnly` is
 * still false, and the write-time guard (see storage/guard) protects only a newer or unreadable
 * Layout, so a commit made too early can overwrite a normal version-1 Layout it has not seen.
 */
export function useLayout(options?: StorageItemOptions) {
  const [layout, update, loaded, readOnly] = useStorageItem(layoutItem, options)
  const commit = useCallback((next: Layout) => update(next), [update])
  return { commit, layout, loaded, readOnly }
}
