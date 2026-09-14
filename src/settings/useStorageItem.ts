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
 */
export function useStorageItem<T>(item: StorageItemLike<T>): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(item.fallback)

  useEffect(() => {
    let active = true
    void item.getValue().then((stored) => {
      if (active) setValue(stored)
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

  return [value, update]
}
