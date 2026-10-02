import * as v from 'valibot'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ManifestSchema } from '@/photos/schema'
import { manifestCache } from '@/photos/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { describeCode } from './conditions'
import { cacheKey, fetchWeather, searchPlaces } from './openMeteo'

const PLACE = { name: 'Victoria', latitude: 48.43, longitude: -123.37 }

const FORECAST = {
  utc_offset_seconds: -25200,
  timezone: 'America/Vancouver',
  current: { temperature_2m: 12.3, apparent_temperature: 11.9, is_day: 0, weather_code: 3 },
  daily: {
    temperature_2m_max: [16.1],
    temperature_2m_min: [9.3],
    sunrise: ['2026-10-01T07:13'],
    sunset: ['2026-10-01T18:51'],
  },
}

const respond = (body: unknown, ok = true) => {
  const fetch = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const requested = (fetch: ReturnType<typeof vi.fn>) => new URL(fetch.mock.calls[0]?.[0] as string)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchWeather', () => {
  it('asks for the place in the chosen unit and reads the answer', async () => {
    const fetch = respond(FORECAST)

    expect(await fetchWeather(PLACE, 'fahrenheit')).toEqual({
      temperature: 12.3,
      feelsLike: 11.9,
      high: 16.1,
      low: 9.3,
      code: 3,
      isDay: false,
      sunrise: '2026-10-01T07:13',
      sunset: '2026-10-01T18:51',
    })
    const url = requested(fetch)
    expect(url.origin).toBe('https://api.open-meteo.com')
    expect(url.searchParams.get('latitude')).toBe('48.43')
    expect(url.searchParams.get('longitude')).toBe('-123.37')
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
    expect(url.searchParams.get('timezone')).toBe('auto')
  })

  it('returns null for a bad status, an unknown shape and a network error', async () => {
    respond(FORECAST, false)
    expect(await fetchWeather(PLACE, 'celsius')).toBeNull()

    respond({ current: {} })
    expect(await fetchWeather(PLACE, 'celsius')).toBeNull()

    respond({ ...FORECAST, daily: { ...FORECAST.daily, sunrise: ['7:13 AM'] } })
    expect(await fetchWeather(PLACE, 'celsius')).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await fetchWeather(PLACE, 'celsius')).toBeNull()
  })
})

describe('searchPlaces', () => {
  it('returns places with rounded coordinates and a label that tells them apart', async () => {
    const fetch = respond({
      results: [
        {
          id: 6174041,
          name: 'Victoria',
          latitude: 48.4359,
          longitude: -123.35155,
          admin1: 'British Columbia',
          country: 'Canada',
        },
        { id: 241131, name: 'Victoria', latitude: -4.62001, longitude: 55.45501 },
      ],
    })

    expect(await searchPlaces('Victoria')).toEqual([
      {
        id: 6174041,
        place: { name: 'Victoria', latitude: 48.44, longitude: -123.35 },
        label: 'Victoria, British Columbia, Canada',
      },
      {
        id: 241131,
        place: { name: 'Victoria', latitude: -4.62, longitude: 55.46 },
        label: 'Victoria',
      },
    ])
    expect(requested(fetch).searchParams.get('name')).toBe('Victoria')
  })

  it('returns nothing when nothing matches, which the API says by leaving results out', async () => {
    respond({ generationtime_ms: 0.4 })

    expect(await searchPlaces('qqqqqq')).toEqual([])
  })

  it('returns null when the search fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    expect(await searchPlaces('Victoria')).toBeNull()
  })
})

describe('endpoints from the manifest', () => {
  const withWeather = (weather: unknown) =>
    manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: v.parse(ManifestSchema, { ...makeManifest([makePhoto('a')]), weather }),
    })

  it('asks wherever the manifest says, keeping the address it leaves alone', async () => {
    await withWeather({ forecastUrl: 'https://weather.example.com/v1/forecast' })
    const fetch = respond(FORECAST)

    await fetchWeather(PLACE, 'celsius')
    expect(requested(fetch).origin).toBe('https://weather.example.com')
    expect(requested(fetch).searchParams.get('latitude')).toBe('48.43')

    fetch.mockClear()
    await searchPlaces('Victoria')
    expect(requested(fetch).origin).toBe('https://geocoding-api.open-meteo.com')
  })

  it('asks nothing when the manifest switches the weather off', async () => {
    await withWeather({ enabled: false })
    const fetch = respond(FORECAST)

    expect(await fetchWeather(PLACE, 'celsius')).toBeNull()
    expect(await searchPlaces('Victoria')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a weather block it cannot read, such as an unencrypted address', async () => {
    await withWeather({ forecastUrl: 'http://weather.example.com/v1/forecast' })
    const fetch = respond(FORECAST)

    await fetchWeather(PLACE, 'celsius')
    expect(requested(fetch).origin).toBe('https://api.open-meteo.com')
    expect(v.parse(ManifestSchema, { ...makeManifest([makePhoto('a')]), weather: 'no' })).toEqual(
      makeManifest([makePhoto('a')]),
    )
  })
})

describe('cacheKey', () => {
  it('changes with the place and with the unit', () => {
    expect(cacheKey(PLACE, 'celsius')).toBe('48.43,-123.37,celsius')
    expect(cacheKey(PLACE, 'fahrenheit')).not.toBe(cacheKey(PLACE, 'celsius'))
  })
})

describe('describeCode', () => {
  it('names the codes it knows and calls the rest cloud', () => {
    expect(describeCode(0)).toEqual({ condition: 'clear', label: 'Clear' })
    expect(describeCode(95)).toEqual({ condition: 'thunderstorm', label: 'Thunderstorm' })
    expect(describeCode(42)).toEqual({ condition: 'overcast', label: 'Cloudy' })
  })
})
