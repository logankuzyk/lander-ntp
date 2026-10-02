import type { PhotoSettings } from '@/photos/rotation'

import type { FontId } from './fonts'

export type Settings = {
  /** Which photo is on screen, and how often it changes. */
  photos: PhotoSettings
  clock: {
    enabled: boolean
    hour12: boolean
    showDate: boolean
    showSeconds: boolean
  }
  weather: WeatherSettings
  font: FontId
  /** Lay a slight wash over the photo, so light text holds up over bright ones. */
  dim: boolean
}

/** A place picked in settings. Only what the forecast request and the widget need. */
export type Place = {
  /** As shown in the widget, e.g. "Victoria". */
  name: string
  latitude: number
  longitude: number
}

/** The optional lines under the temperature. */
export const WEATHER_FIELDS = ['location', 'condition', 'feelsLike', 'highLow', 'sun'] as const

export type WeatherField = (typeof WEATHER_FIELDS)[number]

export type WeatherFieldSetting = { id: WeatherField; shown: boolean }

export type WeatherSettings = {
  enabled: boolean
  /** Null until a place is picked; the widget stays hidden without one. */
  place: Place | null
  unit: 'celsius' | 'fahrenheit'
  /** Sit on the same translucent panel as the popovers, rather than straight on the photo. */
  background: boolean
  /** Every field once, in the order the widget draws them. */
  fields: WeatherFieldSetting[]
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
  photos: {
    mode: 'cycle',
    frequency: 'every-visit',
    tags: [],
    pinnedId: null,
  },
  clock: {
    enabled: true,
    hour12: localeUsesHour12(),
    showDate: false,
    showSeconds: false,
  },
  weather: {
    // Off until asked for: it is the only thing that sends a place anywhere.
    enabled: false,
    place: null,
    unit: localeUsesFahrenheit() ? 'fahrenheit' : 'celsius',
    background: false,
    fields: [
      { id: 'location', shown: true },
      { id: 'sun', shown: true },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
      { id: 'highLow', shown: false },
    ],
  },
  font: 'system',
  dim: true,
}
