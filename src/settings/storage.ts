import { storage } from 'wxt/utils/storage'

import type { FontId } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'

/** v1's font choices, mapped onto the logankuzyk.com typefaces that replaced them. */
const REPLACED_FONTS: Record<string, FontId> = {
  inter: 'geist',
  'space-grotesk': 'geist',
  'jetbrains-mono': 'geist-mono',
  fraunces: 'instrument-serif',
}

/**
 * Synced by the browser, so settings follow you between devices. Bump `version` and add a
 * migration when the shape changes.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    // v2 swapped the font list for the ones the website uses.
    2: (settings: Settings): Settings => ({
      ...settings,
      font: REPLACED_FONTS[settings.font] ?? settings.font,
    }),
  },
})
