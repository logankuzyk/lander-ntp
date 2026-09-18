import { storage } from 'wxt/utils/storage'

import type { FontId } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'

/** The photo credit and details switches, dropped in v4. */
type Widgets = { widgets?: { credit: boolean; info: boolean } }

/** Everything up to v2, before the photo wash was a setting. */
type SettingsBeforeDim = Omit<SettingsBeforeTelemetry, 'dim'> & Widgets

/** Everything up to v4, before usage data was a setting. */
type SettingsBeforeTelemetry = Omit<Settings, 'telemetry'>

/** v3: the wash had arrived, the widget switches had not gone yet. */
type SettingsWithWidgets = SettingsBeforeTelemetry & Widgets

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
    4: (settings: SettingsWithWidgets): SettingsBeforeTelemetry => {
      const migrated = { ...settings }
      delete migrated.widgets
      return migrated
    },
    // v5 added the usage data switch, on as for a fresh install.
    5: (settings: SettingsBeforeTelemetry): Settings => ({ ...settings, telemetry: true }),
  },
})
