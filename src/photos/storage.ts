import { storage } from 'wxt/utils/storage'

import type { PhotoState } from './rotation'
import type { Manifest } from './schema'

export type ManifestCache = {
  data: Manifest
  etag: string | null
  /** Epoch ms of the last successful fetch or 304. */
  fetchedAt: number
}

export const manifestCache = storage.defineItem<ManifestCache>('local:manifestCache')

export const photoState = storage.defineItem<PhotoState>('local:photoState')
