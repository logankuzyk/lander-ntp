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
  /** Storage refused the change and the stored value has been put back (or a newer change is on its way). */
  onRejected?: () => void
  /** The change was written. A change replaced by a newer one while it waited is not reported. */
  onSaved?: () => void
}

// One queue per item, shared by everything that writes it, so its saves cannot overlap.
const queues = new WeakMap<object, WriteQueue<never>>()
const queueFor = <T>(item: StorageItemLike<T>): WriteQueue<T> => {
  let queue = queues.get(item) as WriteQueue<T> | undefined
  if (!queue) {
    queue = createWriteQueue((value: T) => item.setValue(value))
    queues.set(item, queue as WriteQueue<never>)
  }
  return queue
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
 * holds is put back and `onRejected` is called.
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
  // Counts updates, so a rejection can tell whether a newer change has since taken over.
  const latest = useRef(0)

  const update = useCallback(
    (next: T) => {
      const mine = ++latest.current
      setValue(next)
      void queueFor(item)
        .save(next)
        .then(async (result) => {
          if (result === 'saved') handlers.current.onSaved?.()
          if (result !== 'rejected') return
          // Put back what the browser still holds, unless a newer change has taken over: that one
          // is on its way to storage, and puts itself back if it fails too.
          try {
            const stored = await item.getValue()
            if (latest.current === mine) setValue(stored)
          } catch {
            // Nothing to put back from: leave what is shown.
          }
          handlers.current.onRejected?.()
        })
    },
    [item],
  )

  return [value, update, loaded]
}
