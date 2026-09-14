import { useCallback, useEffect, useState } from 'preact/hooks'

/** The part of WXT's storage item this hook needs (also easy to fake in tests). */
export type StorageItemLike<T> = {
  fallback: T
  getValue: () => Promise<T>
  setValue: (value: T) => Promise<void>
  watch: (callback: (value: T | null) => void) => () => void
}

/**
 * Read and write a storage item. Starts from the item's fallback, then swaps in the stored
 * value, and watches for changes so other open tabs (and other synced devices) stay current.
 *
 * The third element says whether the stored value has arrived. Anything that would act on a
 * setting — rather than just render it — must wait for that, or it acts on the fallback.
 */
export function useStorageItem<T>(
  item: StorageItemLike<T>,
): [T, (value: T) => void, loaded: boolean] {
  const [value, setValue] = useState<T>(item.fallback)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    void item.getValue().then((stored) => {
      if (!active) return
      setValue(stored)
      setLoaded(true)
    })
    const unwatch = item.watch((next) => setValue(next ?? item.fallback))
    return () => {
      active = false
      unwatch()
    }
  }, [item])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      void item.setValue(next)
    },
    [item],
  )

  return [value, update, loaded]
}
