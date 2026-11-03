import { checkLayout } from '@/layout/check'
import { COLS, type Rect } from '@/layout/geometry'
import { layoutItem } from '@/layout/storage'
import type { StoredLayout } from '@/layout/types'
import { NEWS } from '@/onboarding/callouts'
import type { Onboarding } from '@/onboarding/storage'
import { onboardingItem, pendingItem } from '@/onboarding/storage'
import { manifestCache, photoState } from '@/photos/storage'
import type { Place, Settings } from '@/settings/schema'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { cacheKey, type Weather } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { makeManifest, makePlace, makeWeather, STORY_PHOTOS } from './fixtures'

export type PageSeed = {
  /** What `sync:layout` holds. Without it the page works the Layout out from `settings`. */
  layout?: StoredLayout
  /** The photo manifest's say over the weather: `{ enabled: false }` switches it off. */
  manifestWeather?: { enabled: boolean }
  /** Readings, in degrees Celsius, for other places a stored Layout's Weathers are at. */
  moreWeather?: readonly { place: Place; weather: Weather }[]
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
  manifestWeather,
  moreWeather = [],
  onboarding,
  pending,
  settings = DEFAULT_SETTINGS,
  weather,
}: PageSeed = {}) {
  await manifestCache.setValue({
    data: {
      ...makeManifest(
        STORY_PHOTOS.map((photo) => ({
          ...photo,
          pageUrl: absolute(photo.pageUrl),
          sizes: photo.sizes.map((size) => ({ ...size, url: absolute(size.url) })),
        })),
      ),
      ...(manifestWeather && { weather: manifestWeather }),
    },
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
  for (const more of moreWeather) {
    await weatherSource.cache.set(cacheKey(more.place, 'celsius'), {
      data: more.weather,
      fetchedAt: Date.now(),
    })
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
const weatherAt = (id: string, col: number, row: number, place: Place = makePlace()) => ({
  col,
  h: 2,
  id,
  options: { place, unit: 'celsius' },
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

const VANCOUVER = makePlace({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })

/** Two Weathers for different places, side by side near the top: they differ only by name. */
const TWO_WEATHERS: StoredLayout = {
  v: 1,
  widgets: [weatherAt('weather1', 4, 3), weatherAt('weather2', 8, 3, VANCOUVER)],
}

/**
 * A Clock in the middle and a Weather with room on its right (column 2, row 2): the options
 * popover opens to the right of it. Stored, so the page draws it where it says.
 */
const OPTIONS_WEATHER_BESIDE: StoredLayout = {
  v: 1,
  widgets: [clockAt('clock0aa', 5, 4, 4), weatherAt('weather1', 2, 2)],
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
  /** Two Weathers, one for Victoria and one for Vancouver, each with its reading. */
  gridTwoWeathers: {
    layout: TWO_WEATHERS,
    moreWeather: [{ place: VANCOUVER, weather: makeWeather({ temperature: 9.1 }) }],
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },

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
  /**
   * A Clock in the middle and a Weather with room on its right, both stored: the options
   * popover opens to the right of either.
   */
  optionsWeatherBeside: {
    layout: OPTIONS_WEATHER_BESIDE,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
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

/** What a Weather's box says when it has no reading to show. */
export type WeatherBoxState = 'failed' | 'loading' | 'off'

/** The sizes the Weather stories draw it at. */
export type WeatherBoxSize = 'largest' | 'smallest' | 'starting'

/**
 * The cells a Weather is drawn in at one of its sizes, from the Grid's top right corner, where
 * an update puts it. Worked out from its definition, so the stories follow its sizes.
 */
export function weatherBoxRect(size: WeatherBoxSize): Rect {
  const { sizes } = weatherDefinition
  const { h, w } =
    size === 'starting' ? sizes.starting(defaultOptions(weatherDefinition)) : sizes[size]
  return { col: COLS + 1 - w, h, row: 1, w }
}

/**
 * A page with one Weather, at one of its sizes, that has no reading to show: `loading` has none
 * cached and its request never answers (see `stubRequests`), `failed` has none and its request
 * fails, and `off` has the photo manifest switch the weather off. The Weather stories and the
 * test that checks them both draw from this.
 */
export function weatherStateSeed(state: WeatherBoxState, size: WeatherBoxSize): PageSeed {
  const { col, h, row, w } = weatherBoxRect(size)
  return {
    layout: {
      v: 1,
      widgets: [
        {
          col,
          h,
          id: 'weather1',
          options: { place: makePlace(), unit: 'celsius' },
          row,
          type: 'weather',
          w,
        },
      ],
    },
    manifestWeather: state === 'off' ? { enabled: false } : undefined,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
  }
}

/**
 * A page with one Weather that has no place, at one of its sizes, so the box draws its setup
 * button ("Choose a place"). Its options are empty, as a Weather's are when added. Nothing is
 * cached or fetched. The Weather setup stories and the test that checks them draw from this.
 */
export function weatherSetupSeed(size: WeatherBoxSize): PageSeed {
  const { col, h, row, w } = weatherBoxRect(size)
  return {
    layout: {
      v: 1,
      widgets: [{ col, h, id: 'weather1', options: {}, row, type: 'weather', w }],
    },
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
  }
}

/**
 * Stands in for the network in a story, so it asks nobody: `hang` never answers, so a
 * Weather is left loading; `fail` fails as if offline. Returns what puts the real one back.
 */
export function stubRequests(kind: 'fail' | 'hang'): () => void {
  const real = globalThis.fetch
  globalThis.fetch = () =>
    kind === 'hang'
      ? new Promise<Response>(() => {})
      : Promise.reject(new TypeError('Failed to fetch'))
  return () => {
    globalThis.fetch = real
  }
}
