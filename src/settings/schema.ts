import type { PhotoSettings } from '@/photos/rotation'

import type { FontId } from './fonts'

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
export type Place = {
  latitude: number
  longitude: number
  /** As shown in the widget, e.g. "Victoria". */
  name: string
}

/** The optional lines under the temperature. */
export const WEATHER_FIELDS = ['location', 'condition', 'feelsLike', 'highLow', 'sun'] as const

export type WeatherField = (typeof WEATHER_FIELDS)[number]

export type WeatherFieldSetting = { id: WeatherField; shown: boolean }

export type WeatherSettings = {
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
