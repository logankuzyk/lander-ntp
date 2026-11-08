import { type StorageItemOptions, useStorageItem } from '@/settings/useStorageItem'

import { backgroundItem } from './storage'

/** The synced background choice and whether it has arrived or is read-only. */
export function useBackground(options?: StorageItemOptions) {
  const [value, set, loaded, readOnly] = useStorageItem(backgroundItem, options)
  return { loaded, readOnly, set, value }
}
