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
    tag: v.nullable(v.string()),
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
 * Settings in any other shape are replaced by the defaults rather than migrated: those stored
 * by an older release (0.1.1 kept a flat `frequency` and favourite sites), or synced from a
 * device still running one.
 */
const current = (value: unknown): Settings =>
  v.is(SettingsSchema, value) ? (value as Settings) : DEFAULT_SETTINGS

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
