import { storage } from 'wxt/utils/storage'

import type { PhotoState } from './rotation'
import type { Manifest } from './schema'

/** Bump when parsing changes in a way an older cache might have lost. */
export const MANIFEST_CACHE_SHAPE = 2

export type ManifestCache = {
  data: Manifest
  etag: string | null
  /** Epoch ms of the last successful fetch or 304. */
  fetchedAt: number
  /** Shape of the parsed manifest cache, so schema changes force a full revalidation. */
  shape?: number
}

export const manifestCache = storage.defineItem<ManifestCache>('local:manifestCache')

export const photoState = storage.defineItem<PhotoState>('local:photoState')
