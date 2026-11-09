import { h } from 'preact'

import {
  DEFAULT_SETTINGS,
  type Place,
  WEATHER_FIELDS,
  type WeatherField,
  type WeatherSettings,
} from '@/settings/schema'
import { allowLocation, locationConsented } from '@/weather/consent'
import { askForLocation, CURRENT_LOCATION, locationAllowed } from '@/weather/deviceLocation'
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
 * has to ask, so everywhere else this is met at once, in the first render. On Firefox the setup
 * button asks for it: `allowLocation` is called first thing in the click, which is what shows
 * Firefox's prompt.
 */
const locationConsent: Need<WeatherOptions> = {
  action: { kind: 'ask', run: allowLocation },
  id: 'locationConsent',
  label: 'Allow sending your place',
  met: () => (import.meta.env.BROWSER === 'firefox' ? locationConsented() : true),
}

/**
 * A place is picked, or the device's own is followed. The setup button opens the options at the
 * place search, where either is done.
 */
const place: Need<WeatherOptions> = {
  action: { kind: 'option', option: 'place' },
  id: 'place',
  label: 'Choose a place',
  met: (options) => options.followDevice || options.place !== null,
}

/**
 * While following the device, the browser lets this page read where it is. Permissions are not
 * synced, so a Weather told to follow the device on another device has not been allowed there:
 * without this it would show the last position stored, or nothing. A picked place does not need
 * it, so that is met at once. The setup button asks the browser for it, from the click.
 */
const deviceLocation: Need<WeatherOptions> = {
  action: { kind: 'ask', run: () => askForLocation() },
  id: 'deviceLocation',
  label: 'Allow location',
  met: ({ followDevice }) => (followDevice ? locationAllowed() : true),
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
  credit: { href: 'https://open-meteo.com/', text: 'Weather data by Open-Meteo.com' },
  // Loading and switched off say what the shared words do.
  messages: { failed: "Can't reach the forecast" },
  name: 'Weather',
  needs: [locationConsent, place, deviceLocation],
  // The order and wording are copied from the settings panel (the page-wide switch last).
  // Defaults come from today's settings, so those cannot drift.
  options: [
    {
      control: 'place',
      default: {
        followDevice: DEFAULT_SETTINGS.weather.followDevice,
        place: DEFAULT_SETTINGS.weather.place,
      },
      id: 'place',
      label: 'Place',
      // Searching sends what is typed, and "Current location" the device's position, so neither
      // is allowed before the user has agreed to send a place (on Firefox).
      needs: ['locationConsent'],
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
    // Label and value are opposite: checked means hour12 is false, so a form inverts it.
    { control: 'switch', id: 'hour12', invert: true, label: '24-hour time', shared: 'hour12' },
  ],
  // With no more than one line on, the Weather fits at 1 by 1. Two or more need 2 by 2.
  // Starting-size table for LR-185: 0 or 1 line: 1 by 1; 2–5 lines: 2 by 2. At 2 by 2 all
  // five lines fit across and down, with type of 20px (1440 by 900) to 13px (800 by 600); below
  // that the Grid's cells are too small to read and the type shrinks to fit. Measured in all four
  // fonts at 1440 by 900, 1366 by 768, 1280 by 720, 800 by 600, 600 by 700 and 390 by 800. The
  // Weather fills any box, as big as fits across and down. It is nearly as wide as tall, so 4 by
  // 3 is as much room as it can use on a desktop window; the fourth column helps on a narrow one.
  sizes: {
    largest: { h: 3, w: 4 },
    smallest: ({ fields }) =>
      fields.filter(({ shown }) => shown).length <= 1 ? { h: 1, w: 1 } : { h: 2, w: 2 },
    starting: ({ fields }) =>
      fields.filter(({ shown }) => shown).length <= 1 ? { h: 1, w: 1 } : { h: 2, w: 2 },
  },
  source: { source: weatherSource, useQuery: useWeatherQuery },
  // From the options alone, as following the device is: the name of the place it is at is
  // looked up later, and a name that changed when it arrived would be announced again.
  summary: ({ followDevice, place }) => (followDevice ? CURRENT_LOCATION : place?.name),
  type: 'weather',
  View: WeatherView,
}
