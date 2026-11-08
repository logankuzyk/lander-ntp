import { type StorageItemOptions, useStorageItem } from '@/settings/useStorageItem'

import { favouritesItem } from './favourites'

/** The synced favourite ids and whether they have arrived or are read-only. */
export function useFavourites(options?: StorageItemOptions) {
  const [value, set, loaded, readOnly] = useStorageItem(favouritesItem, options)
  return { loaded, readOnly, set, value }
}
