import { h } from 'preact'

import {
  DEFAULT_SETTINGS,
  type Place,
  WEATHER_FIELDS,
  type WeatherField,
  type WeatherSettings,
} from '@/settings/schema'
import { locationConsented } from '@/weather/consent'
import { CURRENT_LOCATION } from '@/weather/deviceLocation'
import { cacheKey, fetchWeather, type Weather as Reading } from '@/weather/openMeteo'
import { useDevicePosition } from '@/weather/useDevicePosition'
import { weatherSource } from '@/weather/weatherSource'
import type { SourceQuery, WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'
import type { Need } from '@/widgetSystem/needs'

import { Weather } from './Weather'

/** What a Weather keeps of its own. The 12/24-hour switch is the page's, not the Weather's. */
export type WeatherOptions = Pick<WeatherSettings, 'fields' | 'followDevice' | 'place' | 'unit'>

/** The name of the place the reading is for: the one the View draws. */
type PlaceName = string

/** Hands the Weather its options, the reading, the place's name and the page's time format. */
function WeatherView({
  context,
  options,
  page,
  reading,
}: WidgetViewProps<WeatherOptions, Reading, PlaceName>) {
  return h(Weather, {
    fields: options.fields,
    hour12: page.hour12,
    place: context,
    weather: reading,
  })
}

/**
 * Whether a place may be sent anywhere from this device; see weather/consent. Only Firefox
 * has to ask, so everywhere else this is met at once, in the first render.
 */
const locationConsent: Need<WeatherOptions> = {
  id: 'locationConsent',
  met: () => (import.meta.env.BROWSER === 'firefox' ? locationConsented() : true),
}

/** A place is picked, or the device's own is followed. */
const place: Need<WeatherOptions> = {
  id: 'place',
  met: (options) => options.followDevice || options.place !== null,
}

/**
 * The forecast for the place to show: the one picked, or, while following the device, where it
 * is. Following starts only once the needs are met, so Firefox's agreement is held back from
 * the device's position and the name lookup as well as from the forecast. Nothing is loaded
 * until there is a place, such as before the device's position is known.
 */
function useWeatherQuery(options: WeatherOptions): SourceQuery<Reading, PlaceName> {
  const { followDevice, unit } = options
  const position = useDevicePosition(followDevice)
  const found: Place | null = followDevice
    ? position && { ...position, name: position.name ?? CURRENT_LOCATION }
    : options.place
  return {
    // Not drawn without a reading, which needs a place; the empty name is never read.
    context: found?.name ?? '',
    query: found && { fetch: () => fetchWeather(found, unit), key: cacheKey(found, unit) },
  }
}

const LABELS: Record<WeatherField, string> = {
  condition: 'Conditions',
  feelsLike: 'Feels like',
  highLow: 'High and low',
  location: 'Location',
  sun: 'Sunrise and sunset',
}

export const weatherDefinition: WidgetDefinition<WeatherOptions, Reading, PlaceName> = {
  name: 'Weather',
  needs: [locationConsent, place],
  // The order and wording are copied from the settings panel. Defaults come from today's
  // settings, so those cannot drift.
  options: [
    {
      control: 'place',
      default: {
        followDevice: DEFAULT_SETTINGS.weather.followDevice,
        place: DEFAULT_SETTINGS.weather.place,
      },
      id: 'place',
      label: 'Place',
    },
    {
      choices: [
        { label: 'Celsius', value: 'celsius' },
        { label: 'Fahrenheit', value: 'fahrenheit' },
      ],
      control: 'choice',
      default: DEFAULT_SETTINGS.weather.unit,
      id: 'unit',
      label: 'Units',
    },
    {
      control: 'orderedList',
      default: DEFAULT_SETTINGS.weather.fields,
      id: 'fields',
      items: WEATHER_FIELDS.map((id) => ({ id, label: LABELS[id] })),
      label: 'Show',
    },
    // Label and value are opposite: checked means hour12 is false. A form must invert it, as SettingsPanel does with !hour12.
    { control: 'switch', id: 'hour12', label: '24-hour time', shared: 'hour12' },
  ],
  // The smallest holds every line the options can turn on, and a Weather starts there for
  // everyone (owner answer 1 on LR-19, over LR-16's 2 by 1). W9 fixes the largest by measuring.
  sizes: {
    largest: { h: 3, w: 4 },
    smallest: { h: 2, w: 2 },
    starting: () => ({ h: 2, w: 2 }),
  },
  source: { source: weatherSource, useQuery: useWeatherQuery },
  type: 'weather',
  View: WeatherView,
}
