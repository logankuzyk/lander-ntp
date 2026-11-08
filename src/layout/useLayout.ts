import { useCallback, useMemo } from 'preact/hooks'

import type { Settings } from '@/settings/schema'
import { type StorageItemOptions, useStorageItem } from '@/settings/useStorageItem'

import { deriveLayout } from './derive'
import { layoutItem } from './storage'
import type { Layout } from './types'

/**
 * The Layout, and how to change it. No UI: it only stores and reads.
 *
 * - `layout` is the stored Layout, or, while none is stored, the one worked out from `settings`
 *   (see `deriveLayout`). Nothing is written to get it: not on load, not when settings change,
 *   and not when the window is resized. It follows the settings until the first `commit`.
 *   `settings` should be the stored ones, so wait for those before acting on the Layout, as the
 *   fallback is the defaults.
 * - `loaded` is true once the stored Layout has been looked for. Until then `layout` is the
 *   worked-out one, which a Layout that turns up may replace.
 * - `readOnly` is true while a newer version of the page wrote the Layout (or it has no shape
 *   to read). Nothing is saved then.
 * - `commit(next)` shows the whole Layout at once and saves it in one write, stamped `v: 1`.
 *   The first one stores everything that was worked out, ids and waiting options included, in
 *   `sync:layout` and nowhere in `sync:settings`; a Layout with no Widgets is a stored Layout,
 *   so deleting everything does not bring the worked-out one back. Saves go one at a time with
 *   only the latest waiting (twenty commits are two writes). When the browser rejects the write
 *   the stored Layout is put back (the worked-out one, when none was stored) and `onRejected`
 *   is called, so the page can say so. It does nothing while read-only.
 *
 * Call `commit` only once `loaded` is true. Before the stored Layout has arrived `readOnly` is
 * still false, and the write-time guard (see storage/guard) protects only a newer or unreadable
 * Layout, so a commit made too early can overwrite a normal version-1 Layout it has not seen.
 */
export function useLayout(settings: Settings, options?: StorageItemOptions) {
  const [stored, update, loaded, readOnly] = useStorageItem(layoutItem, options)
  const derived = useMemo(() => deriveLayout(settings), [settings])
  const commit = useCallback((next: Layout) => update(next), [update])
  return { commit, layout: stored ?? derived, loaded, readOnly }
}
