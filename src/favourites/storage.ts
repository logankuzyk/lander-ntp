import { storage } from 'wxt/utils/storage'

import type { Favourite } from './schema'

/** Synced, like settings, so favourite sites follow you between devices. */
export const favouritesItem = storage.defineItem<Favourite[]>('sync:favourites', {
  fallback: [],
  version: 1,
  migrations: {},
})
