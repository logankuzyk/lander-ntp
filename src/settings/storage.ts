import { storage } from 'wxt/utils/storage'

import { DEFAULT_SETTINGS, type Settings } from './schema'

/**
 * Synced by the browser, so settings follow you between devices. Bump `version` and add a
 * migration when the shape changes.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
  migrations: {},
})
