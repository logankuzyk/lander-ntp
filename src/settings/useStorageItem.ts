import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { NewerVersionError } from '@/storage/guard'
import { createWriteQueue, type WriteQueue } from '@/storage/writeQueue'

/** The part of WXT's storage item this hook needs (also easy to fake in tests). */
export type StorageItemLike<T> = {
  fallback: T
  getValue: () => Promise<T>
  /**
   * The stored value, and whether a newer version of the page wrote it (see storage/guard). An
   * item that cannot be newer need not have one.
   */
  read?: () => Promise<{ newer: boolean; value: T }>
  setValue: (value: T) => Promise<void>
  /** `newer` is true when a newer version wrote the value. */
  watch: (callback: (value: T | null, newer?: boolean) => void) => () => void
}

/**
 * Calls `then` with what is stored. It is the stored value's own promise that `then` hangs on,
 * with no hop in between: a change that lands in the same tick as the read has to beat it
 * (see the test "keeps a change that lands before the first read resolves").
 */
const whenRead = <T>(
  item: StorageItemLike<T>,
  then: (stored: { newer: boolean; value: T }) => void,
) =>
  item.read
    ? item.read().then(then)
    : item.getValue().then((value) => then({ newer: false, value }))

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
    entry = {
      latest: 0,
      // A newer version's value is refused, which is not a failure to save: see `readOnly`.
      queue: createWriteQueue(
        (value: T) => item.setValue(value),
        (error) => error instanceof NewerVersionError,
      ),
    }
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
 * The fourth element is true while a newer version of the page wrote what is stored. Nothing is
 * saved then: `update` does nothing, as the page is read-only (see storage/guard).
 *
 * `update` shows the new value at once, then saves it, one write at a time with only the latest
 * change waiting behind one in flight. If the browser rejects the write, the value it still
 * holds is put back and `onRejected` is called (first, before that value has been read). If the
 * write is refused because a newer version has arrived since the page last read, that is no
 * failure to save: the page goes read-only, the newer value is put back, and `onRejected` is
 * not called.
 */
export function useStorageItem<T>(
  item: StorageItemLike<T>,
  options: StorageItemOptions = {},
): [T, (value: T) => void, loaded: boolean, readOnly: boolean] {
  const [value, setValue] = useState<T>(item.fallback)
  const [loaded, setLoaded] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  // What `update` goes by when it is called: the latest render's.
  const readOnlyNow = useRef(readOnly)
  readOnlyNow.current = readOnly

  useEffect(() => {
    let active = true
    // A change can land before the first read resolves; the read is older, so it loses.
    let changed = false
    const arrived = (stored: { newer: boolean; value: T }) => {
      if (!active) return
      if (!changed) {
        setValue(stored.value)
        setReadOnly(stored.newer)
      }
      setLoaded(true)
    }
    void whenRead(item, arrived)
    const unwatch = item.watch((next, newer) => {
      changed = true
      setValue(next ?? item.fallback)
      setReadOnly(next !== null && newer === true)
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
      if (readOnlyNow.current) return
      const entry = savesFor(item)
      // Counts changes to the item from every hook, so a rejection can tell whether a newer one
      // has since taken over.
      const mine = ++entry.latest
      setValue(next)
      void entry.queue.save(next).then(async (result) => {
        if (result === 'saved') handlers.current.onSaved?.()
        if (result === 'refused') setReadOnly(true)
        if (result !== 'rejected' && result !== 'refused') return
        // Before reading anything back, so a newer change that is saved meanwhile is heard of
        // after this rejection, not before it.
        if (result === 'rejected') handlers.current.onRejected?.()
        // Put back what the browser still holds, unless a newer change has taken over: that one
        // is on its way to storage, and puts itself back if it fails too.
        try {
          await whenRead(item, (stored) => {
            if (entry.latest === mine) setValue(stored.value)
          })
        } catch {
          // Nothing to put back from: leave what is shown.
        }
      })
    },
    [item],
  )

  return [value, update, loaded, readOnly]
}
