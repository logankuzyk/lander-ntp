import { render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { manifestCache } from '@/photos/storage'
import { DEFAULT_SETTINGS, type WeatherSettings } from '@/settings/schema'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { cacheKey, type Weather } from './openMeteo'
import { weatherCache } from './storage'
import { MAX_AGE_MS, useWeather } from './useWeather'

const PLACE = { name: 'Victoria', latitude: 48.43, longitude: -123.37 }

const ON: WeatherSettings = { ...DEFAULT_SETTINGS.weather, enabled: true, place: PLACE }

const READING: Weather = {
  temperature: 5,
  feelsLike: 3,
  high: 8,
  low: 1,
  code: 0,
  isDay: true,
  sunrise: '2026-10-01T07:13',
  sunset: '2026-10-01T18:51',
}

/** A forecast response with the given temperature. */
const forecast = (temperature: number) => ({
  ok: true,
  json: () =>
    Promise.resolve({
      current: {
        temperature_2m: temperature,
        apparent_temperature: temperature,
        is_day: 1,
        weather_code: 0,
      },
      daily: {
        temperature_2m_max: [temperature],
        temperature_2m_min: [temperature],
        sunrise: ['2026-10-01T07:13'],
        sunset: ['2026-10-01T18:51'],
      },
    }),
})

function Probe({ settings }: { settings: WeatherSettings | null }) {
  const weather = useWeather(settings)
  return <output>{weather ? String(weather.temperature) : 'none'}</output>
}

const shown = () => screen.getByRole('status').textContent

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useWeather', () => {
  it('fetches nothing while switched off, without a place, or before settings load', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    render(<Probe settings={null} />)
    render(<Probe settings={{ ...ON, enabled: false }} />)
    render(<Probe settings={{ ...ON, place: null }} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches and caches the weather when nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(12)))

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('12'))
    expect(await weatherCache.getValue()).toMatchObject({
      key: cacheKey(PLACE, ON.unit),
      data: { temperature: 12 },
    })
  })

  it('serves a fresh cache without asking again', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await weatherCache.setValue({
      key: cacheKey(PLACE, ON.unit),
      fetchedAt: Date.now(),
      data: READING,
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('5'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows a stale cache, then the refreshed reading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(12)))
    await weatherCache.setValue({
      key: cacheKey(PLACE, ON.unit),
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      data: READING,
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('5'))
    await waitFor(() => expect(shown()).toBe('12'))
  })

  it('keeps a stale reading when the refresh fails', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    await weatherCache.setValue({
      key: cacheKey(PLACE, ON.unit),
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      data: READING,
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(shown()).toBe('5')
  })

  it('shows nothing, cached or fetched, when the manifest switches the weather off', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: { ...makeManifest([makePhoto('a')]), weather: { enabled: false } },
    })
    await weatherCache.setValue({
      key: cacheKey(PLACE, ON.unit),
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      data: READING,
    })

    render(<Probe settings={ON} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(shown()).toBe('none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a cache for another place or unit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(54)))
    await weatherCache.setValue({
      key: cacheKey(PLACE, 'celsius'),
      fetchedAt: Date.now(),
      data: READING,
    })

    render(<Probe settings={{ ...ON, unit: 'fahrenheit' }} />)

    await waitFor(() => expect(shown()).toBe('54'))
  })
})
