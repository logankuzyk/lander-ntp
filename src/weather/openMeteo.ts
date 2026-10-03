import * as v from 'valibot'

import type { Place, WeatherSettings } from '@/settings/schema'

import { getEndpoints } from './endpoints'

/** As for the photo manifest: a stalled connection shouldn't leave a request hanging. */
export const FETCH_TIMEOUT_MS = 5000

export type Weather = {
  /** WMO weather code; see `describeCode`. */
  code: number
  feelsLike: number
  high: number
  isDay: boolean
  low: number
  /** Wall-clock time at the place, as an ISO string without an offset, e.g. "2026-10-01T07:13". */
  sunrise: string
  sunset: string
  /** In the unit that was asked for. */
  temperature: number
}

/** "2026-10-01T07:13": the widget reads these as dates, so anything else is refused here. */
const LocalTimeSchema = v.pipe(v.string(), v.isoDateTime())

const ForecastSchema = v.object({
  current: v.object({
    apparent_temperature: v.number(),
    is_day: v.number(),
    temperature_2m: v.number(),
    weather_code: v.number(),
  }),
  daily: v.object({
    sunrise: v.tuple([LocalTimeSchema]),
    sunset: v.tuple([LocalTimeSchema]),
    temperature_2m_max: v.tuple([v.number()]),
    temperature_2m_min: v.tuple([v.number()]),
  }),
})

const SearchSchema = v.object({
  results: v.optional(
    v.array(
      v.object({
        admin1: v.optional(v.string()),
        country: v.optional(v.string()),
        id: v.number(),
        latitude: v.number(),
        longitude: v.number(),
        name: v.string(),
      }),
    ),
    [],
  ),
})

export type PlaceResult = {
  id: number
  /** Enough to tell one Victoria from another, e.g. "Victoria, British Columbia, Canada". */
  label: string
  place: Place
}

/** Null on network errors, timeouts, bad statuses and data in a shape it doesn't know. */
export async function getJson<T extends v.GenericSchema>(
  url: string,
  params: Record<string, string>,
  schema: T,
): Promise<v.InferOutput<T> | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // The manifest can move these addresses, and the new one may come with a query of its own.
    const target = new URL(url)
    for (const [name, value] of Object.entries(params)) target.searchParams.set(name, value)
    const response = await fetch(target.href, { signal: controller.signal })
    if (!response.ok) return null
    const result = v.safeParse(schema, await response.json())
    return result.success ? result.output : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Two decimals is about a kilometre: plenty for weather, and no more precise than a town. */
const round = (degrees: number) => Math.round(degrees * 100) / 100

/** Places matching a name. Null when the search itself failed, rather than found nothing. */
export async function searchPlaces(name: string): Promise<PlaceResult[] | null> {
  const { enabled, searchUrl } = await getEndpoints()
  if (!enabled) return null
  const found = await getJson(
    searchUrl,
    { count: '5', format: 'json', language: navigator.language.split('-')[0] ?? 'en', name },
    SearchSchema,
  )
  if (!found) return null
  return found.results.map((result) => ({
    id: result.id,
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
    place: {
      latitude: round(result.latitude),
      longitude: round(result.longitude),
      name: result.name,
    },
  }))
}

/** What a cached reading is for: it is only good for the same place in the same unit. */
export const cacheKey = (place: Place, unit: WeatherSettings['unit']) =>
  `${place.latitude},${place.longitude},${unit}`

/** The weather now and today's range at a place, or null when it can't be had. */
export async function fetchWeather(
  place: Place,
  unit: WeatherSettings['unit'],
): Promise<Weather | null> {
  const { enabled, forecastUrl } = await getEndpoints()
  if (!enabled) return null
  const forecast = await getJson(
    forecastUrl,
    {
      current: 'temperature_2m,apparent_temperature,is_day,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
      forecast_days: '1',
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      temperature_unit: unit,
      // Sunrise, sunset and "today" in the place's own time.
      timezone: 'auto',
    },
    ForecastSchema,
  )
  if (!forecast) return null
  const { current, daily } = forecast
  return {
    code: current.weather_code,
    feelsLike: current.apparent_temperature,
    high: daily.temperature_2m_max[0],
    isDay: current.is_day === 1,
    low: daily.temperature_2m_min[0],
    sunrise: daily.sunrise[0],
    sunset: daily.sunset[0],
    temperature: current.temperature_2m,
  }
}
