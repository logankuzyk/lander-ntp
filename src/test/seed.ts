import { browser } from 'wxt/browser'

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
  layout?: unknown
  /** The photo manifest's say over the weather: `{ enabled: false }` switches it off. */
  manifestWeather?: { enabled: boolean }
  /** Readings, in degrees Celsius, for other places a stored Layout's Weathers are at. */
  moreWeather?: readonly { place: Place; weather: Weather }[]
  /** The record synced between devices: what a returning install has. */
  onboarding?: Onboarding
  /** A new install's record, kept on this device until the welcome is answered. */
  pending?: Onboarding
  /** A raw sync value, including a version this code cannot write. */
  rawLayout?: unknown
  settings?: Settings
  /** A reading for the place in `settings.weather`, so the Weather shows without asking the forecast. */
  weather?: Weather
}

/** Story photos are served from the page's own origin, but the manifest only allows http(s). */
const absolute = (url: string) => new URL(url, globalThis.location.href).href

/**
 * Stores a reading for a place, fresh. For a story whose `play` adds a Weather for a place no
 * Weather on the page was at: the page forgets readings no Weather uses once it has loaded
 * (`usePruneReadings`), so one seeded with the page is gone by then.
 */
export async function seedReading(
  place: Place,
  unit: Settings['weather']['unit'],
  weather: Weather,
) {
  await weatherSource.cache.set(cacheKey(place, unit), { data: weather, fetchedAt: Date.now() })
}

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
  rawLayout,
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
  if (rawLayout) await browser.storage.sync.set({ layout: rawLayout })
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

/**
 * Nine Widgets, one more than the Widget limit: the eight above and a Weather below the middle.
 * A Layout can come to hold more than the limit (two devices that each added one before syncing,
 * or a lower limit), and it loads whole: nothing is removed or hidden.
 */
const NINE_WIDGETS: StoredLayout = {
  v: 1,
  widgets: [...EIGHT_WIDGETS.widgets, weatherAt('weather5', 6, 7)],
}

/**
 * The whole Grid taken by four Clocks of sizes a Clock may have (8 by 4 and 4 by 4): no cell is
 * left, so the Add menu has no room for anything.
 */
const FULL_OF_CLOCKS: StoredLayout = {
  v: 1,
  widgets: [
    clockAt('clock0aa', 1, 1, 8),
    clockAt('clock0bb', 9, 1, 4),
    clockAt('clock0cc', 1, 5, 8),
    clockAt('clock0dd', 9, 5, 4),
  ].map((clock) => ({ ...clock, h: 4 })),
}

/**
 * An update from v0.2.3 with the Weather off but set up for Victoria (in degrees Celsius): its
 * options are kept as waiting, and the first Weather added starts from them.
 */
const WEATHER_OFF_BUT_SET_UP: Settings = {
  ...DEFAULT_SETTINGS,
  weather: { ...DEFAULT_SETTINGS.weather, enabled: false, place: makePlace(), unit: 'celsius' },
}

const VANCOUVER = makePlace({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })

/** Two Weathers for different places, side by side near the top: they differ only by name. */
const TWO_WEATHERS: StoredLayout = {
  v: 1,
  widgets: [weatherAt('weather1', 4, 3), weatherAt('weather2', 8, 3, VANCOUVER)],
}

/**
 * A Clock with room to grow all round it (columns 3 to 6, rows 3 and 4: its largest, 8 by 4,
 * fits from there) and the Weather in the top right corner: the resize stories pull its handle.
 */
const RESIZE_ROOM: StoredLayout = {
  v: 1,
  widgets: [clockAt('clock0aa', 3, 3, 4), weatherAt('weather1', 11, 1)],
}

/**
 * A Clock (columns 3 to 6) and a Weather (columns 8 and 9) in the same two rows, with a column
 * between them: growing the Clock by one column touches the Weather, by two takes its cells.
 */
const RESIZE_BESIDE: StoredLayout = {
  v: 1,
  widgets: [clockAt('clock0aa', 3, 4, 4), weatherAt('weather1', 8, 4)],
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
  /** Eight Widgets, the Widget limit, with room left: the Add menu says why it adds nothing. */
  addMenuAtLimit: {
    layout: EIGHT_WIDGETS,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** No cell is free: the Add menu's items are unavailable, each with its reason. */
  addMenuNoRoom: {
    layout: FULL_OF_CLOCKS,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
  },
  /** A new install, past the welcome: the Add menu has the Clock and the Weather to offer. */
  addMenuOpen: { onboarding: { dismissed: SEEN_NEWS, welcomed: true } },
  /** Weather off but set up for Victoria; the first Weather added starts from that. */
  addMenuWaitingOptions: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: WEATHER_OFF_BUT_SET_UP,
    weather: makeWeather({ temperature: 13.4 }),
  },
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
  /** A stored Layout of nine, over the Widget limit: all nine are drawn. */
  gridNineWidgets: {
    layout: NINE_WIDGETS,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** A Clock and a Weather one column apart: to pull the handle onto a neighbour. */
  gridResizeBeside: {
    layout: RESIZE_BESIDE,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** A Clock with room all round it, and the Weather in the corner: to pull the handle. */
  gridResizeRoom: {
    layout: RESIZE_ROOM,
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
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

  /** The same update with both off: an empty Grid, as before, and the note says Add brings them back. */
  layoutNewsBothOff: {
    onboarding: { dismissed: [], welcomed: true },
    settings: { ...DEFAULT_SETTINGS, clock: { ...DEFAULT_SETTINGS.clock, enabled: false } },
  },
  /**
   * The first tab after updating from v0.2.3 with the Clock and the Weather both on: welcomed
   * long ago, nothing dismissed, so the note about the Layout is up at the Edit button.
   */
  layoutNewsClockAndWeather: {
    onboarding: { dismissed: [], welcomed: true },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** The same update with the Clock on and the Weather off (the settings as they come). */
  layoutNewsClockOnly: { onboarding: { dismissed: [], welcomed: true } },
  /** The same update with the Clock off and the Weather on but with no place: its setup button. */
  layoutNewsWeatherOnly: {
    onboarding: { dismissed: [], welcomed: true },
    settings: {
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true },
    },
  },
  /** A Layout saved by a newer version, with one known and one unknown Widget. */
  newerLayout: {
    onboarding: { dismissed: SEEN_NEWS, welcomed: true },
    rawLayout: {
      v: 2,
      widgets: [
        clockAt('clocknew1', 5, 4, 4),
        {
          col: 1,
          h: 2,
          id: 'future01',
          options: { colour: 'teal' },
          row: 1,
          type: 'bookmarks',
          w: 2,
        },
      ],
    },
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
  /**
   * The first tab after installing, with the Clock and a Weather for Victoria both on (the
   * settings an install might have by now): the welcome, then a tour of two widgets and no
   * setup button. A new install on its defaults has the Clock alone (`newInstall`).
   */
  tourClockAndWeather: {
    pending: { dismissed: SEEN_NEWS, welcomed: false },
    settings: GRID_WEATHER_SETTINGS,
    weather: makeWeather({ temperature: 13.4 }),
  },
  /** The first tab after installing, with both off: the welcome over an empty Grid. */
  tourEmptyGrid: {
    pending: { dismissed: SEEN_NEWS, welcomed: false },
    settings: { ...DEFAULT_SETTINGS, clock: { ...DEFAULT_SETTINGS.clock, enabled: false } },
  },
  /**
   * The first tab after installing, with the Clock off and a Weather on that has no place: its
   * setup button is on the page, so the tour has a stop for it.
   */
  tourWeatherWaiting: {
    pending: { dismissed: SEEN_NEWS, welcomed: false },
    settings: {
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true },
    },
  },
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

/** What a Weather's setup button asks for: a place, Firefox's agreement, or the device's location. */
export type WeatherSetupKind = 'consent' | 'location' | 'place'

/**
 * A page with one Weather at one of its sizes that is waiting for something, so the box draws
 * its setup button. Nothing is cached or fetched. The Weather setup stories and the test that
 * checks them draw from this. What the button says depends on the options and on the browser,
 * which the story sets up as well (see `.storybook/browserStubs`):
 *
 * - `place` (the default): the options are empty, as a Weather's are when added, so "Choose a
 *   place".
 * - `consent`: a place is picked, but on Firefox without the agreement to send it, so "Allow
 *   sending your place".
 * - `location`: it follows the device, which the browser has not allowed this page to read, so
 *   "Allow location".
 */
export function weatherSetupSeed(size: WeatherBoxSize, kind: WeatherSetupKind = 'place'): PageSeed {
  const { col, h, row, w } = weatherBoxRect(size)
  const options = {
    consent: { place: makePlace(), unit: 'celsius' },
    location: { followDevice: true, unit: 'celsius' },
    place: {},
  }[kind]
  return {
    layout: {
      v: 1,
      widgets: [{ col, h, id: 'weather1', options, row, type: 'weather', w }],
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
