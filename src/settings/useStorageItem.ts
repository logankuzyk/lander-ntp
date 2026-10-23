import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { createWriteQueue, type WriteQueue } from '@/storage/writeQueue'

/** The part of WXT's storage item this hook needs (also easy to fake in tests). */
export type StorageItemLike<T> = {
  fallback: T
  getValue: () => Promise<T>
  setValue: (value: T) => Promise<void>
  watch: (callback: (value: T | null) => void) => () => void
}

/** What to do about a save, besides showing the new value at once. */
export type StorageItemOptions = {
  /** Storage refused the change. The stored value is being put back, unless a newer change is on its way. */
  onRejected?: () => void
  /** The change was written. A change replaced by a newer one while it waited is not reported. */
  onSaved?: () => void
}

/** What every hook on one item shares: its saves, and a count of the changes made to it. */
type Saves<T> = { latest: number; queue: WriteQueue<T> }

const saves = new WeakMap<object, Saves<never>>()
const savesFor = <T>(item: StorageItemLike<T>): Saves<T> => {
  let entry = saves.get(item) as Saves<T> | undefined
  if (!entry) {
    entry = { latest: 0, queue: createWriteQueue((value: T) => item.setValue(value)) }
    saves.set(item, entry as Saves<never>)
  }
  return entry
}

/**
 * Read and write a storage item. Starts from the item's fallback, then swaps in the stored
 * value, and watches for changes so other open tabs (and other synced devices) stay current.
 *
 * The third element says whether the stored value has arrived. Anything that would act on a
 * setting — rather than just render it — must wait for that, or it acts on the fallback.
 *
 * `update` shows the new value at once, then saves it, one write at a time with only the latest
 * change waiting behind one in flight. If the browser refuses the write, the value it still
 * holds is put back and `onRejected` is called (first, before that value has been read).
 */
export function useStorageItem<T>(
  item: StorageItemLike<T>,
  options: StorageItemOptions = {},
): [T, (value: T) => void, loaded: boolean] {
  const [value, setValue] = useState<T>(item.fallback)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    // A change can land before the first read resolves; the read is older, so it loses.
    let changed = false
    void item.getValue().then((stored) => {
      if (!active) return
      if (!changed) setValue(stored)
      setLoaded(true)
    })
    const unwatch = item.watch((next) => {
      changed = true
      setValue(next ?? item.fallback)
    })
    return () => {
      active = false
      unwatch()
    }
  }, [item])

  // Read when a save ends, not when it starts, so the latest callbacks answer it.
  const handlers = useRef(options)
  handlers.current = options
  const update = useCallback(
    (next: T) => {
      const entry = savesFor(item)
      // Counts changes to the item from every hook, so a rejection can tell whether a newer one
      // has since taken over.
      const mine = ++entry.latest
      setValue(next)
      void entry.queue.save(next).then(async (result) => {
        if (result === 'saved') handlers.current.onSaved?.()
        if (result !== 'rejected') return
        // Before reading anything back, so a newer change that is saved meanwhile is heard of
        // after this rejection, not before it.
        handlers.current.onRejected?.()
        // Put back what the browser still holds, unless a newer change has taken over: that one
        // is on its way to storage, and puts itself back if it fails too.
        try {
          const stored = await item.getValue()
          if (entry.latest === mine) setValue(stored)
        } catch {
          // Nothing to put back from: leave what is shown.
        }
      })
    },
    [item],
  )

  return [value, update, loaded]
}
