import { checkLayout } from '@/layout/check'
import { layoutItem } from '@/layout/storage'
import type { StoredLayout } from '@/layout/types'
import { NEWS } from '@/onboarding/callouts'
import type { Onboarding } from '@/onboarding/storage'
import { onboardingItem, pendingItem } from '@/onboarding/storage'
import { manifestCache, photoState } from '@/photos/storage'
import type { Settings } from '@/settings/schema'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { cacheKey, type Weather } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { makeManifest, makePlace, makeWeather, STORY_PHOTOS } from './fixtures'

export type PageSeed = {
  /** What `sync:layout` holds. Without it the page works the Layout out from `settings`. */
  layout?: StoredLayout
  /** The record synced between devices: what a returning install has. */
  onboarding?: Onboarding
  /** A new install's record, kept on this device until the welcome is answered. */
  pending?: Onboarding
  settings?: Settings
  /** A reading for the place in `settings.weather`, so the Weather shows without asking the forecast. */
  weather?: Weather
}

/** Story photos are served from the page's own origin, but the manifest only allows http(s). */
const absolute = (url: string) => new URL(url, globalThis.location.href).href

/**
 * Fills the (fake) browser storage so `App` draws a given state of the page with nothing to
 * fetch: the photos come from a fresh manifest cache, so `getManifest` serves them and does not
 * revalidate. Stories call it from `beforeEach`; tests call it before rendering.
 */
export async function seedPage({
  layout,
  onboarding,
  pending,
  settings = DEFAULT_SETTINGS,
  weather,
}: PageSeed = {}) {
  await manifestCache.setValue({
    data: makeManifest(
      STORY_PHOTOS.map((photo) => ({
        ...photo,
        pageUrl: absolute(photo.pageUrl),
        sizes: photo.sizes.map((size) => ({ ...size, url: absolute(size.url) })),
      })),
    ),
    etag: null,
    fetchedAt: Date.now(),
  })
  // The rotation draws from this bag, so the first photo is always the same one, not a random one.
  await photoState.setValue({
    bag: STORY_PHOTOS.map((photo) => photo.id),
    currentId: null,
    shownAt: Date.now(),
  })
  await settingsItem.setValue(settings)
  if (layout) await layoutItem.setValue(checkLayout(layout))
  if (weather) {
    const { place, unit } = settings.weather
    if (!place) throw new Error('seedPage: a weather reading needs settings.weather.place')
    await weatherSource.cache.set(cacheKey(place, unit), { data: weather, fetchedAt: Date.now() })
  }
  if (onboarding) await onboardingItem.setValue(onboarding)
  if (pending) await pendingItem.setValue(pending)
}

/** What an install that has seen all the news has dismissed, as `recordInstall` writes it. */
const SEEN_NEWS = NEWS.map(({ id }) => id)

/** Weather on for Victoria in degrees Celsius, as an update from 0.2.x leaves the settings. */
const GRID_WEATHER_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: makePlace(), unit: 'celsius' },
}

/** A Weather as the Layout stores it: the Victoria reading seeded above is the one it shows. */
const weatherAt = (id: string, col: number, row: number) => ({
  col,
  h: 2,
  id,
  options: { place: makePlace(), unit: 'celsius' },
  row,
  type: 'weather',
  w: 2,
})

/** A Clock as the Layout stores it. */
const clockAt = (id: string, col: number, row: number, w: number, showSeconds = false) => ({
  col,
  h: 2,
  id,
  options: { showDate: true, showSeconds },
  row,
  type: 'clock',
  w,
})

/** The Grid with eight Widgets on it: Clocks in the middle rows and the top, Weathers in the corners. */
const EIGHT_WIDGETS: StoredLayout = {
  v: 1,
  widgets: [
    clockAt('clock0aa', 5, 4, 4),
    clockAt('clock0bb', 1, 4, 4),
    clockAt('clock0cc', 9, 4, 4),
    clockAt('clock0dd', 4, 1, 6, true),
    weatherAt('weather1', 1, 1),
    weatherAt('weather2', 11, 1),
    weatherAt('weather3', 1, 7),
    weatherAt('weather4', 11, 7),
  ],
}

/**
 * The states of the whole page that the `App` stories show. Defined once, so a story and
 * the test that checks it cannot drift apart.
 */
export const PAGE_SEEDS = {
  /** A Clock with seconds, which is wider. */
  gridClockWithSeconds: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: {
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, showSeconds: true },
    },
  },
  /** A stored Layout of eight Widgets: four Clocks and four Weathers, all for one place. */
  gridEightWidgets: {
    layout: EIGHT_WIDGETS,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** Both off: an empty Grid over the photo. */
  gridEmpty: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: { ...DEFAULT_SETTINGS, clock: { ...DEFAULT_SETTINGS.clock, enabled: false } },
  },
  /** A new install, past the welcome: the Layout worked out from the defaults, the Clock alone. */
  gridNewInstall: { onboarding: { dismissed: SEEN_NEWS, welcomed: true } },

  /**
   * Someone who updated with the Clock and the Weather on: the Layout is worked out from their
   * settings, and nothing is stored in `sync:layout`.
   */
  gridUpdatedClockAndWeather: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** The first tab after installing: the welcome, over the photo. */
  newInstall: { pending: { dismissed: SEEN_NEWS, welcomed: false } },
  /** Someone using it day to day, with the settings as they come. */
  settledInstall: { onboarding: { dismissed: SEEN_NEWS, welcomed: true } },
  /** Someone who had the extension before the weather arrived, and is told about it. */
  weatherNews: { onboarding: { dismissed: [], welcomed: true } },
  /** Weather switched on with a place, showing a reading. */
  weatherOn: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: {
      ...DEFAULT_SETTINGS,
      weather: {
        ...DEFAULT_SETTINGS.weather,
        enabled: true,
        place: makePlace(),
        unit: 'celsius',
      },
    },
    weather: makeWeather({ temperature: 13.4 }),
  },
} satisfies Record<string, PageSeed>
