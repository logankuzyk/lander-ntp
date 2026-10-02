import { render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { manifestCache } from '@/photos/storage'
import { DEFAULT_SETTINGS, type WeatherSettings } from '@/settings/schema'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { devicePosition } from './deviceLocation'
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
  return (
    <output data-place={weather?.place}>
      {weather ? String(weather.weather.temperature) : 'none'}
    </output>
  )
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

  describe('following the device', () => {
    const FOLLOW: WeatherSettings = { ...ON, place: null, followDevice: true }
    const HERE = { latitude: 48.43, longitude: -123.37 }
    const AWAY = { latitude: 49.28, longitude: -123.12 }

    /** The browser's answers: whether location is allowed, and where the device is. */
    const device = (state: 'granted' | 'prompt', coords = HERE) => {
      const getCurrentPosition = vi.fn((done: (position: unknown) => void) => done({ coords }))
      vi.stubGlobal('navigator', {
        language: 'en-CA',
        geolocation: { getCurrentPosition },
        permissions: { query: () => Promise.resolve({ state }) },
      })
      return getCurrentPosition
    }

    /** Answers the forecast with a temperature, and the name lookup with a town (or a failure). */
    const answering = (temperature: number, city: string | null) => {
      const fetch = vi.fn((url: string) =>
        url.includes('reverse-geocode')
          ? Promise.resolve({ ok: city !== null, json: () => Promise.resolve({ city }) })
          : Promise.resolve(forecast(temperature)),
      )
      vi.stubGlobal('fetch', fetch)
      return fetch
    }

    const requests = (fetch: ReturnType<typeof answering>, to: string) =>
      fetch.mock.calls
        .map(([url]) => new URL(url))
        .filter((url) => url.href.includes(to))
        .map(({ searchParams }) => ({
          latitude: Number(searchParams.get('latitude')),
          longitude: Number(searchParams.get('longitude')),
        }))

    const cached = (position: typeof HERE) =>
      weatherCache.setValue({
        key: cacheKey({ name: '', ...position }, ON.unit),
        fetchedAt: Date.now(),
        data: READING,
      })

    const place = () => screen.getByRole('status').getAttribute('data-place')

    it('fetches the weather for where the device is, names it and remembers both', async () => {
      device('granted')
      const fetch = answering(12, 'Victoria')

      render(<Probe settings={FOLLOW} />)

      await waitFor(() => expect(shown()).toBe('12'))
      expect(place()).toBe('Victoria')
      expect(requests(fetch, 'forecast')).toEqual([HERE])
      expect(requests(fetch, 'reverse-geocode')).toEqual([HERE])
      expect(await devicePosition.getValue()).toEqual({ ...HERE, name: 'Victoria' })
    })

    it('moves to the new place when the device has moved since the last tab', async () => {
      device('granted', AWAY)
      const fetch = answering(15, 'Vancouver')
      await devicePosition.setValue({ ...HERE, name: 'Victoria' })
      await cached(HERE)

      render(<Probe settings={FOLLOW} />)

      await waitFor(() => expect(shown()).toBe('15'))
      expect(place()).toBe('Vancouver')
      expect(requests(fetch, 'forecast')).toEqual([AWAY])
      expect(await devicePosition.getValue()).toEqual({ ...AWAY, name: 'Vancouver' })
    })

    it('stays put for a position close to the last one, asking for nothing', async () => {
      device('granted', { latitude: 48.45, longitude: -123.36 })
      const fetch = answering(12, 'Saanich')
      await devicePosition.setValue({ ...HERE, name: 'Victoria' })
      await cached(HERE)

      render(<Probe settings={FOLLOW} />)

      await waitFor(() => expect(shown()).toBe('5'))
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(fetch).not.toHaveBeenCalled()
      expect(place()).toBe('Victoria')
    })

    it('says "Current location" when the name can’t be had, and tries again next time', async () => {
      device('granted')
      answering(12, null)

      const first = render(<Probe settings={FOLLOW} />)
      await waitFor(() => expect(shown()).toBe('12'))
      expect(place()).toBe('Current location')
      first.unmount()

      const fetch = answering(12, 'Victoria')
      render(<Probe settings={FOLLOW} />)

      await waitFor(() => expect(place()).toBe('Victoria'))
      // The forecast was already cached for here; only the name was missing.
      expect(requests(fetch, 'forecast')).toEqual([])
    })

    it('never asks for the position where that would show a prompt', async () => {
      const getCurrentPosition = device('prompt')
      const fetch = answering(12, 'Victoria')

      render(<Probe settings={FOLLOW} />)
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(getCurrentPosition).not.toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
      expect(shown()).toBe('none')
    })
  })
})
