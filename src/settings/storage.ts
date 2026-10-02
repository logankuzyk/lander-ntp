import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

import { FREQUENCIES } from '@/photos/rotation'

import { DEFAULT_SETTINGS, type Settings, WEATHER_FIELDS } from './schema'

/**
 * The shape the page reads. Fonts stay loose: fontStack falls back for one it doesn't know,
 * as happens when another device is on a newer version.
 */
const SettingsSchema = v.object({
  clock: v.object({
    enabled: v.boolean(),
    hour12: v.boolean(),
    showDate: v.boolean(),
    showSeconds: v.boolean(),
  }),
  dim: v.boolean(),
  font: v.string(),
  photos: v.object({
    frequency: v.picklist(FREQUENCIES),
    mode: v.picklist(['cycle', 'pinned']),
    pinnedId: v.nullable(v.string()),
    tags: v.array(v.string()),
  }),
  // Settings stored by 0.2.x predate the weather widget: they keep everything else and get
  // its defaults.
  weather: v.optional(
    v.object({
      background: v.boolean(),
      enabled: v.boolean(),
      fields: v.pipe(
        v.array(v.object({ id: v.picklist(WEATHER_FIELDS), shown: v.boolean() })),
        // Each field exactly once: the settings list has a row for every one.
        v.check(
          (fields) =>
            fields.length === WEATHER_FIELDS.length &&
            new Set(fields.map(({ id }) => id)).size === WEATHER_FIELDS.length,
        ),
      ),
      followDevice: v.boolean(),
      place: v.nullable(
        v.object({ latitude: v.number(), longitude: v.number(), name: v.string() }),
      ),
      unit: v.picklist(['celsius', 'fahrenheit']),
    }),
    DEFAULT_SETTINGS.weather,
  ),
})

/**
 * Settings in any other shape get the defaults: those stored by 0.1.1, which kept a flat
 * `frequency` and favourite sites, and any a newer version has changed. Nothing is migrated;
 * a block added since is filled in with its defaults.
 */
const current = (value: unknown): Settings => {
  const result = v.safeParse(SettingsSchema, value)
  return result.success ? (result.output as Settings) : DEFAULT_SETTINGS
}

// No version or migrations: nothing is stored alongside the settings themselves.
const stored = storage.defineItem<Settings>('sync:settings', { fallback: DEFAULT_SETTINGS })

/** Synced by the browser, so settings follow you between devices. */
export const settingsItem = {
  fallback: DEFAULT_SETTINGS,
  getValue: async (): Promise<Settings> => current(await stored.getValue()),
  key: stored.key,
  setValue: (value: Settings): Promise<void> => stored.setValue(value),
  watch: (callback: (value: Settings | null) => void): (() => void) =>
    stored.watch((value) => callback(value === null ? null : current(value))),
}
