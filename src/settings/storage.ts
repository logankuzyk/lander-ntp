import * as v from 'valibot'

import { defineGuardedItem } from '@/storage/guard'
import { syncedShapes } from '@/sync/shapes'

import { DEFAULT_SETTINGS, type Settings } from './schema'

/** Check the current shape while retaining unknown keys and filling optional blocks. */
const current = (value: unknown): Settings => {
  const parsed = v.safeParse(syncedShapes.settings.schema, value)
  if (!parsed.success) return DEFAULT_SETTINGS
  const output = parsed.output as Settings
  // A newer settings item can still contain a shape this page understands. Keep those known
  // values for display while defineGuardedItem marks the item read-only from its stored `v`.
  // Reject malformed versions here just as the shared shape check does.
  if (output.v !== undefined && !Number.isSafeInteger(output.v)) return DEFAULT_SETTINGS
  return {
    ...output,
    v: (output.v ?? 1) as 1,
    weather: output.weather ?? DEFAULT_SETTINGS.weather,
  }
}

const guarded = defineGuardedItem<Settings>({
  check: current,
  fallback: DEFAULT_SETTINGS,
  key: 'sync:settings',
  version: DEFAULT_SETTINGS.v,
})

/** Synced by the browser, so settings follow you between devices. */
export const settingsItem = {
  fallback: DEFAULT_SETTINGS,
  getValue: async (): Promise<Settings> => (await guarded.read()).value,
  key: guarded.key,
  /** The settings and whether a newer version wrote them, which makes them read-only. */
  read: guarded.read,
  /** Throws a NewerVersionError, writing nothing, when the stored settings are newer. */
  setValue: (value: Settings): Promise<void> => guarded.write(value),
  watch: (callback: (value: Settings | null, newer?: boolean) => void): (() => void) =>
    guarded.watch((read) => (read ? callback(read.value, read.newer) : callback(null))),
}
