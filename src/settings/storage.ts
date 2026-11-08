import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

import { syncedShapes } from '@/sync/shapes'

import { DEFAULT_SETTINGS, type Settings } from './schema'

/**
 * Settings in any other shape get the defaults: those stored by 0.1.1, which kept a flat
 * `frequency` and favourite sites, and any a newer version has changed. Nothing is migrated;
 * a block added since is filled in with its defaults.
 */
const current = (value: unknown): Settings => {
  const result = syncedShapes.settings.check(value)
  if (!result.ok) return DEFAULT_SETTINGS
  const parsed = v.safeParse(syncedShapes.settings.schema, value)
  if (!parsed.success) return DEFAULT_SETTINGS
  const output = parsed.output as Settings
  return { ...output, weather: output.weather ?? DEFAULT_SETTINGS.weather }
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
