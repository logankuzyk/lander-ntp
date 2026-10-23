/**
 * FROZEN. Never update this file. It stands in for a device still on Lander NTP v0.2.3.
 *
 * It is `src/settings/storage.ts` as of v0.2.3 (commit 47b9e0c), with each import replaced by
 * a literal copy of what it imported at that commit, so that changing a live constant later
 * cannot change what this reader accepts:
 *
 * - FREQUENCIES and PhotoSettings, from `src/photos/rotation.ts`
 * - FontId (its keys), from `src/settings/fonts.ts`
 * - DEFAULT_SETTINGS, WEATHER_FIELDS and the Settings types, from `src/settings/schema.ts`
 *
 * Only the import lines and the order of declarations differ; the check itself
 * (`SettingsSchema`, `current`, `stored`, `settingsItem`) is copied as it was, apart from
 * formatting and sorting that the repo's prettier and eslint rules apply to every file. The
 * `compat.test.ts` cases replay what was observed of v0.2.3 (LR-15), so a copy that drifts
 * fails there.
 *
 * If the live reader changes, that is a reason to add a test, not to edit this file.
 */
import * as v from 'valibot'
import { storage } from 'wxt/utils/storage'

// From src/photos/rotation.ts at v0.2.3.

const FREQUENCIES = ['every-visit', '30s', '1m', '5m', '15m', '1h', '6h', '12h', 'daily'] as const

type Frequency = (typeof FREQUENCIES)[number]

type PhotoSettings = {
  /** How fast to cycle. Kept while a photo is pinned, for when cycling resumes. */
  frequency: Frequency
  /** Cycle through photos, or keep one on screen. */
  mode: 'cycle' | 'pinned'
  /** The photo to keep while pinned. Null keeps whichever photo is showing. */
  pinnedId: string | null
  /** Only cycle photos with one of these tag slugs; empty for all of them. Kept while a
   * photo is pinned, for when cycling resumes. */
  tags: string[]
}

// From src/settings/fonts.ts at v0.2.3: the keys of FONTS.

type FontId = 'geist-mono' | 'geist' | 'instrument-serif' | 'system'

// From src/settings/schema.ts at v0.2.3.

export type Settings = {
  clock: {
    enabled: boolean
    hour12: boolean
    showDate: boolean
    showSeconds: boolean
  }
  /** Lay a slight wash over the photo, so light text holds up over bright ones. */
  dim: boolean
  font: FontId
  /** Which photo is on screen, and how often it changes. */
  photos: PhotoSettings
  weather: WeatherSettings
}

/** A place picked in settings. Only what the forecast request and the widget need. */
type Place = {
  latitude: number
  longitude: number
  /** As shown in the widget, e.g. "Victoria". */
  name: string
}

/** The optional lines under the temperature. */
const WEATHER_FIELDS = ['location', 'condition', 'feelsLike', 'highLow', 'sun'] as const

type WeatherField = (typeof WEATHER_FIELDS)[number]

type WeatherFieldSetting = { id: WeatherField; shown: boolean }

type WeatherSettings = {
  enabled: boolean
  /** Every field once, in the order the widget draws them. */
  fields: WeatherFieldSetting[]
  /**
   * Use wherever this device is instead of `place`, and keep up as it moves. The position
   * itself is never stored here: see weather/deviceLocation.
   */
  followDevice: boolean
  /** Null until a place is picked; the widget stays hidden without one. */
  place: Place | null
  unit: 'celsius' | 'fahrenheit'
}

/** Whether this browser's locale writes times as 12-hour. */
const localeUsesHour12 = (): boolean =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false

/** The few regions that use Fahrenheit day to day. */
const FAHRENHEIT_REGIONS = ['US', 'BS', 'BZ', 'KY', 'LR', 'PW', 'FM', 'MH']

const localeUsesFahrenheit = (): boolean => {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region !== undefined && FAHRENHEIT_REGIONS.includes(region)
  } catch {
    return false
  }
}

export const DEFAULT_SETTINGS: Settings = {
  clock: {
    enabled: true,
    hour12: localeUsesHour12(),
    showDate: false,
    showSeconds: false,
  },
  dim: true,
  font: 'system',
  photos: {
    frequency: 'every-visit',
    mode: 'cycle',
    pinnedId: null,
    tags: [],
  },
  weather: {
    // Off until asked for: it is the only thing that sends a place anywhere.
    enabled: false,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: false },
      { id: 'sun', shown: false },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: null,
    unit: localeUsesFahrenheit() ? 'fahrenheit' : 'celsius',
  },
}

// From src/settings/storage.ts at v0.2.3.

/**
 * The shape the page reads. Fonts stay loose: fontStack falls back for one it doesn't know,
 * as happens when another device is on a newer version. Loose at the top for the same reason:
 * a block that device added is kept, so saving from here doesn't take it away.
 */
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
  // Settings stored by 0.2.x predate the weather widget: they keep everything else and get
  // its defaults.
  weather: v.optional(
    v.object({
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
