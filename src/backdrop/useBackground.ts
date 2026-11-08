import { useEffect } from 'preact/hooks'

import { BACKGROUND_HINT_KEY } from '@/backdrop/paintHint'
import { readableInk } from '@/backdrop/readableInk'
import { type StorageItemOptions, useStorageItem } from '@/settings/useStorageItem'

import { backgroundItem } from './storage'

/** The synced background choice and whether it has arrived or is read-only. */
export function useBackground(options?: StorageItemOptions) {
  const [value, set, loaded, readOnly] = useStorageItem(backgroundItem, options)
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(
        BACKGROUND_HINT_KEY,
        JSON.stringify({ colour: value.colour, ink: readableInk(value.colour), kind: value.kind }),
      )
    } catch {
      // The page still draws from synced storage when local storage is unavailable.
    }
  }, [loaded, value])
  return { loaded, readOnly, set, value }
}
