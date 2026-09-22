import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

import { FREQUENCIES } from '@/photos/rotation'

import { DEFAULT_SETTINGS, type Settings } from './schema'

/**
 * The shape the page reads. Fonts stay loose: fontStack falls back for one it doesn't know,
 * as happens when another device is on a newer version.
 */
const SettingsSchema = v.object({
  photos: v.object({
    mode: v.picklist(['cycle', 'pinned']),
    frequency: v.picklist(FREQUENCIES),
    tags: v.array(v.string()),
    pinnedId: v.nullable(v.string()),
  }),
  clock: v.object({
    enabled: v.boolean(),
    hour12: v.boolean(),
    showDate: v.boolean(),
    showSeconds: v.boolean(),
  }),
  font: v.string(),
  dim: v.boolean(),
})

/**
 * Settings in any other shape get the defaults: those stored by 0.1.1, which kept a flat
 * `frequency` and favourite sites, and any a newer version has changed. Nothing is carried
 * over or migrated.
 */
const current = (value: unknown): Settings =>
  v.is(SettingsSchema, value) ? (value as Settings) : DEFAULT_SETTINGS

// No version or migrations: nothing is stored alongside the settings themselves.
const stored = storage.defineItem<Settings>('sync:settings', { fallback: DEFAULT_SETTINGS })

/** Synced by the browser, so settings follow you between devices. */
export const settingsItem = {
  key: stored.key,
  fallback: DEFAULT_SETTINGS,
  getValue: async (): Promise<Settings> => current(await stored.getValue()),
  setValue: (value: Settings): Promise<void> => stored.setValue(value),
  watch: (callback: (value: Settings | null) => void): (() => void) =>
    stored.watch((value) => callback(value === null ? null : current(value))),
}
