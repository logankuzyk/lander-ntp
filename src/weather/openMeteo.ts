import * as v from 'valibot'

import type { Place, WeatherSettings } from '@/settings/schema'

import { getEndpoints } from './endpoints'

/** As for the photo manifest: a stalled connection shouldn't leave a request hanging. */
export const FETCH_TIMEOUT_MS = 5000

export type Weather = {
  /** In the unit that was asked for. */
  temperature: number
  feelsLike: number
  high: number
  low: number
  /** WMO weather code; see `describeCode`. */
  code: number
  isDay: boolean
  /** Wall-clock time at the place, as an ISO string without an offset, e.g. "2026-10-01T07:13". */
  sunrise: string
  sunset: string
}

/** "2026-10-01T07:13": the widget reads these as dates, so anything else is refused here. */
const LocalTimeSchema = v.pipe(v.string(), v.isoDateTime())

const ForecastSchema = v.object({
  current: v.object({
    temperature_2m: v.number(),
    apparent_temperature: v.number(),
    is_day: v.number(),
    weather_code: v.number(),
  }),
  daily: v.object({
    temperature_2m_max: v.tuple([v.number()]),
    temperature_2m_min: v.tuple([v.number()]),
    sunrise: v.tuple([LocalTimeSchema]),
    sunset: v.tuple([LocalTimeSchema]),
  }),
})

const SearchSchema = v.object({
  results: v.optional(
    v.array(
      v.object({
        id: v.number(),
        name: v.string(),
        latitude: v.number(),
        longitude: v.number(),
        admin1: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
    ),
    [],
  ),
})

export type PlaceResult = {
  id: number
  place: Place
  /** Enough to tell one Victoria from another, e.g. "Victoria, British Columbia, Canada". */
  label: string
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
    const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
      signal: controller.signal,
    })
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
    { name, count: '5', language: navigator.language.split('-')[0] ?? 'en', format: 'json' },
    SearchSchema,
  )
  if (!found) return null
  return found.results.map((result) => ({
    id: result.id,
    place: {
      name: result.name,
      latitude: round(result.latitude),
      longitude: round(result.longitude),
    },
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
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
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'temperature_2m,apparent_temperature,is_day,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
      temperature_unit: unit,
      // Sunrise, sunset and "today" in the place's own time.
      timezone: 'auto',
      forecast_days: '1',
    },
    ForecastSchema,
  )
  if (!forecast) return null
  const { current, daily } = forecast
  return {
    temperature: current.temperature_2m,
    feelsLike: current.apparent_temperature,
    high: daily.temperature_2m_max[0],
    low: daily.temperature_2m_min[0],
    code: current.weather_code,
    isDay: current.is_day === 1,
    sunrise: daily.sunrise[0],
    sunset: daily.sunset[0],
  }
}
