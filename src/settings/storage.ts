import { storage } from 'wxt/utils/storage'

import type { Frequency } from '@/photos/rotation'

import type { FontId } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'

/** The photo credit and details switches, dropped in v4. */
type Widgets = { widgets?: { credit: boolean; info: boolean } }

/** Up to v4: a flat frequency (`off` pinned whatever was showing) and favourite sites. */
type SettingsBeforePhotos = Omit<Settings, 'photos'> & {
  frequency: Frequency | 'off'
  favourites?: { enabled: boolean; style: 'list' | 'grid'; size: 's' | 'm' | 'l' }
}

/** Everything up to v2, before the photo wash was a setting. */
type SettingsBeforeDim = Omit<SettingsBeforePhotos, 'dim'> & Widgets

/** v3: the wash had arrived, the widget switches had not gone yet. */
type SettingsWithWidgets = SettingsBeforePhotos & Widgets

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
  version: 5,
  migrations: {
    // v2 swapped the font list for the ones the website uses.
    2: (settings: SettingsBeforeDim): SettingsBeforeDim => ({
      ...settings,
      font: REPLACED_FONTS[settings.font] ?? settings.font,
    }),
    // v3 added the photo wash. Installs from before it get it on, like a fresh one.
    3: (settings: SettingsBeforeDim): SettingsWithWidgets => ({ ...settings, dim: true }),
    // v4 dropped the widget switches: the credit and the details panel are always available.
    4: (settings: SettingsWithWidgets): SettingsBeforePhotos => {
      const migrated = { ...settings }
      delete migrated.widgets
      return migrated
    },
    // v5 grouped the photo settings, so a picked photo keeps the cycling frequency, and
    // dropped favourite sites. `off` becomes pinned to the photo already showing.
    5: ({ frequency, favourites: _, ...settings }: SettingsBeforePhotos): Settings => ({
      ...settings,
      photos:
        frequency === 'off'
          ? { mode: 'pinned', frequency: 'every-visit', tag: null, pinnedId: null }
          : { mode: 'cycle', frequency, tag: null, pinnedId: null },
    }),
  },
})
