import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

import { FREQUENCIES } from '@/photos/rotation'

import type { FontId } from './fonts'
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
  telemetry: v.boolean(),
})

/** Settings in any other shape, such as one a newer version has changed, get the defaults. */
const current = (value: unknown): Settings =>
  v.is(SettingsSchema, value) ? (value as Settings) : DEFAULT_SETTINGS

/**
 * 0.1.1 kept its settings under `sync:settings`, with a flat `frequency` and favourite sites.
 * Devices still on it read that key and break on any other shape, so settings now live under
 * a key of their own and the old one is only ever read.
 *
 * `sync:settings` (with its `sync:settings$` version meta) and `sync:favourites` are left in
 * place for devices still on 0.1.1. They can be removed in a later release, once those have
 * updated.
 */
export const LEGACY_SETTINGS_KEY = 'sync:settings'

// No version or migrations: nothing is stored alongside it but the settings themselves.
const stored = storage.defineItem<Settings>('sync:settings2')

const FrequencySchema = v.picklist(FREQUENCIES)
const ClockSchema = SettingsSchema.entries.clock

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Carry over settings stored by 0.1.1: the clock, font and wash as they were, and its
 * frequency as the cycling one. Its `off` kept whichever photo was showing, as pinning without
 * a photo named does now. Usage data had no switch then, so it starts on, as for a fresh
 * install. Anything missing or malformed gets the default.
 */
export function fromLegacySettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS
  const { frequency, clock, font, dim } = value
  const photos: Settings['photos'] =
    frequency === 'off'
      ? { ...DEFAULT_SETTINGS.photos, mode: 'pinned', pinnedId: null }
      : v.is(FrequencySchema, frequency)
        ? { ...DEFAULT_SETTINGS.photos, frequency }
        : DEFAULT_SETTINGS.photos
  return {
    photos,
    clock: v.is(ClockSchema, clock) ? clock : DEFAULT_SETTINGS.clock,
    font: typeof font === 'string' ? (font as FontId) : DEFAULT_SETTINGS.font,
    dim: typeof dim === 'boolean' ? dim : DEFAULT_SETTINGS.dim,
    telemetry: DEFAULT_SETTINGS.telemetry,
  }
}

/**
 * The stored settings, seeded from 0.1.1's on the first read after upgrading. The seed is
 * written, so it happens once: later changes made on a device still on 0.1.1 stay there.
 */
async function load(): Promise<Settings> {
  const value = await stored.getValue()
  if (value !== null) return current(value)
  const legacy = await storage.getItem<unknown>(LEGACY_SETTINGS_KEY)
  if (legacy === null) return DEFAULT_SETTINGS
  const seeded = fromLegacySettings(legacy)
  await stored.setValue(seeded)
  return seeded
}

/** Synced by the browser, so settings follow you between devices. */
export const settingsItem = {
  key: stored.key,
  fallback: DEFAULT_SETTINGS,
  getValue: load,
  setValue: (value: Settings): Promise<void> => stored.setValue(value),
  watch: (callback: (value: Settings | null) => void): (() => void) =>
    stored.watch((value) => callback(value === null ? null : current(value))),
}
