import * as v from 'valibot'

import { FREQUENCIES } from '../../photos/rotation'
import { WEATHER_FIELDS } from '../../settings/weatherFields'

const SettingsSchema = v.looseObject({
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
  v: v.optional(v.number()),
  weather: v.optional(
    v.object({
      enabled: v.boolean(),
      fields: v.pipe(
        v.array(v.object({ id: v.picklist(WEATHER_FIELDS), shown: v.boolean() })),
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
  ),
})

const OnboardingSchema = v.looseObject({
  dismissed: v.array(v.string()),
  v: v.optional(v.number()),
  welcomed: v.boolean(),
})

const CURRENT_ITEM_VERSION = 1

type ShapeCheck = { ok: false } | { ok: true; v: number }

/** Whether this item carries a numeric version newer than the one the caller understands. */
export const hasNewerVersion = (value: unknown, supportedVersion: number): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'v' in value &&
  typeof value.v === 'number' &&
  value.v > supportedVersion

const check = (schema: v.GenericSchema, value: unknown): ShapeCheck => {
  if (!v.safeParse(schema, value).success) return { ok: false }
  if (typeof value !== 'object' || value === null) return { ok: false }
  const version = 'v' in value ? value.v : undefined
  const itemVersion = version ?? 1
  return typeof itemVersion === 'number' &&
    Number.isSafeInteger(itemVersion) &&
    itemVersion === CURRENT_ITEM_VERSION
    ? { ok: true, v: itemVersion }
    : { ok: false }
}

/** Pure shape checks shared by the extension and the sync server. */
export const syncedShapes = {
  onboarding: {
    check: (value: unknown): ShapeCheck => check(OnboardingSchema, value),
    key: 'onboarding',
    schema: OnboardingSchema,
    version: CURRENT_ITEM_VERSION,
  },
  settings: {
    check: (value: unknown): ShapeCheck => check(SettingsSchema, value),
    key: 'settings',
    schema: SettingsSchema,
    version: CURRENT_ITEM_VERSION,
  },
} as const

/** Count the UTF-8 bytes browsers store for a synced item's key and JSON value. */
export const itemBytes = (key: string, value: unknown): number =>
  new TextEncoder().encode(key + JSON.stringify(value)).byteLength
