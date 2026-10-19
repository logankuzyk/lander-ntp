import { act, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'

import { manifestCache } from '@/photos/storage'
import { DEFAULT_SETTINGS, type Settings, type WeatherSettings } from '@/settings/schema'
import { makeManifest, makePhoto } from '@/test/fixtures'
import { devicePosition } from '@/weather/deviceLocation'
import { cacheKey, type Weather } from '@/weather/openMeteo'
import { weatherCache } from '@/weather/storage'
import { MAX_AGE_MS, MAX_STALE_MS } from '@/weather/weatherSource'
import { pageValues, widgetsFromSettings } from '@/widgetSystem/fromSettings'
import { defaultOptions, readOptions } from '@/widgetSystem/options'
import { widgetDefinition } from '@/widgetSystem/registry'
import { WidgetHost } from '@/widgetSystem/WidgetHost'

import { weatherDefinition } from './definition'

const PLACE = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

/** Only the location line is shown, so the page says which place it is drawing. */
const ONLY_LOCATION: WeatherSettings['fields'] = [
  { id: 'location', shown: true },
  { id: 'highLow', shown: false },
  { id: 'sun', shown: false },
  { id: 'condition', shown: false },
  { id: 'feelsLike', shown: false },
]

const ON: WeatherSettings = {
  ...DEFAULT_SETTINGS.weather,
  enabled: true,
  fields: ONLY_LOCATION,
  place: PLACE,
}

const READING: Weather = {
  code: 0,
  feelsLike: 3,
  high: 8,
  isDay: true,
  low: 1,
  sunrise: '2026-10-01T07:13',
  sunset: '2026-10-01T18:51',
  temperature: 5,
}

/** A forecast response with the given temperature. */
const forecast = (temperature: number) => ({
  json: () =>
    Promise.resolve({
      current: {
        apparent_temperature: temperature,
        is_day: 1,
        temperature_2m: temperature,
        weather_code: 0,
      },
      daily: {
        sunrise: ['2026-10-01T07:13'],
        sunset: ['2026-10-01T18:51'],
        temperature_2m_max: [temperature],
        temperature_2m_min: [temperature],
      },
    }),
  ok: true,
})

/**
 * The page's Widgets for these settings, drawn as `App` draws them (the clock is switched off:
 * only the Weather is under test), or nothing before the settings have loaded.
 */
function Probe({ settings }: { settings: WeatherSettings | null }) {
  const page: Settings | null = settings && {
    ...DEFAULT_SETTINGS,
    clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
    weather: settings,
  }
  return (
    <main>
      {page &&
        widgetsFromSettings(page).map(({ options, type }) => {
          const definition = widgetDefinition(type)
          return (
            definition && (
              <WidgetHost
                definition={definition}
                key={type}
                options={options}
                page={pageValues(page)}
              />
            )
          )
        })}
    </main>
  )
}

/** The temperature on the page, or 'none' when the Weather draws nothing. */
const shown = () =>
  document.querySelector('.weather__temperature')?.textContent?.replace('°', '') ?? 'none'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the Weather definition', () => {
  it('is stored as "weather" and called Weather', () => {
    expect(weatherDefinition.type).toBe('weather')
    expect(weatherDefinition.name).toBe('Weather')
  })

  it("starts a new Weather with the options today's settings default to", () => {
    const { fields, followDevice, place, unit } = DEFAULT_SETTINGS.weather
    expect(defaultOptions(weatherDefinition)).toEqual({ fields, followDevice, place, unit })
  })

  it("keeps 12/24-hour time as the page-wide value, never in the Weather's own options", () => {
    expect(readOptions(weatherDefinition, { hour12: true })).not.toHaveProperty('hour12')
    expect(weatherDefinition.options.find((option) => option.id === 'hour12')).toMatchObject({
      control: 'switch',
      shared: 'hour12',
    })
  })

  it('keeps the place and whether to follow the device as one option, stored under two keys', () => {
    const options = { fields: ONLY_LOCATION, followDevice: true, place: PLACE, unit: 'celsius' }
    expect(readOptions(weatherDefinition, options)).toEqual(options)
    expect(weatherDefinition.options.find((option) => option.id === 'place')).toMatchObject({
      control: 'place',
    })
  })

  it('offers the units as a choice of the two it draws', () => {
    expect(weatherDefinition.options.find((option) => option.id === 'unit')).toMatchObject({
      choices: [
        { label: 'Celsius', value: 'celsius' },
        { label: 'Fahrenheit', value: 'fahrenheit' },
      ],
      control: 'choice',
    })
    const bad = readOptions(weatherDefinition, { unit: 'kelvin' })
    expect(bad).toEqual(defaultOptions(weatherDefinition))
  })

  it('offers the lines as an ordered list holding every field once', () => {
    const fields = weatherDefinition.options.find((option) => option.id === 'fields')
    expect(fields).toMatchObject({ control: 'orderedList' })
    expect(fields && 'items' in fields && fields.items).toEqual([
      { id: 'location', label: 'Location' },
      { id: 'condition', label: 'Conditions' },
      { id: 'feelsLike', label: 'Feels like' },
      { id: 'highLow', label: 'High and low' },
      { id: 'sun', label: 'Sunrise and sunset' },
    ])
    const missing = ONLY_LOCATION.slice(1)
    expect(readOptions(weatherDefinition, { fields: missing })).toEqual(
      defaultOptions(weatherDefinition),
    )
  })

  it("words its options as the settings panel does, in the panel's order", () => {
    expect(weatherDefinition.options.map(({ id, label }) => [id, label])).toEqual([
      ['place', 'Place'],
      ['unit', 'Units'],
      ['fields', 'Show'],
      ['hour12', '24-hour time'],
    ])
  })

  it('needs, in order, the location agreement and then a place', () => {
    expect(weatherDefinition.needs?.map(({ id }) => id)).toEqual(['locationConsent', 'place'])
  })

  it('has a place when one is picked or the device is followed, and not otherwise', () => {
    const place = weatherDefinition.needs?.find(({ id }) => id === 'place')
    const options = defaultOptions(weatherDefinition)
    expect(place?.met({ ...options, followDevice: false, place: null })).toBe(false)
    expect(place?.met({ ...options, followDevice: false, place: PLACE })).toBe(true)
    expect(place?.met({ ...options, followDevice: true, place: null })).toBe(true)
  })

  it('has the location agreement at once on browsers that do not ask for it', () => {
    const consent = weatherDefinition.needs?.find(({ id }) => id === 'locationConsent')
    expect(consent?.met(defaultOptions(weatherDefinition))).toBe(true)
  })
})

describe('the Weather on the page', () => {
  it('draws the Weather with no wrapper of its own, in the place it always was', async () => {
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now(),
      key: cacheKey(PLACE, ON.unit),
    })

    const { container } = render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('5'))
    const main = container.querySelector('main')
    expect(main?.children).toHaveLength(1)
    expect(main?.firstElementChild?.classList.contains('weather')).toBe(true)
    expect(screen.getByRole('region', { name: 'Weather' })).toBe(main?.firstElementChild)
  })

  it('reads the sun times in the page’s 12/24-hour time', async () => {
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now(),
      key: cacheKey(PLACE, ON.unit),
    })
    const options = {
      fields: [{ id: 'sun', shown: true }, ...ONLY_LOCATION.filter(({ id }) => id !== 'sun')],
      followDevice: false,
      place: PLACE,
      unit: ON.unit,
    }

    const twentyFour = render(
      <WidgetHost definition={weatherDefinition} options={options} page={{ hour12: false }} />,
    )
    await waitFor(() => expect(shown()).toBe('5'))
    expect(screen.getByLabelText('Sunrise').textContent).toBe('07:13')
    twentyFour.unmount()

    render(<WidgetHost definition={weatherDefinition} options={options} page={{ hour12: true }} />)
    await waitFor(() => expect(shown()).toBe('5'))
    expect(screen.getByLabelText('Sunrise').textContent).toBe('7:13')
  })
})

describe('the Weather', () => {
  it('fetches nothing while switched off, without a place, or before settings load', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    render(<Probe settings={null} />)
    render(<Probe settings={{ ...ON, enabled: false }} />)
    render(<Probe settings={{ ...ON, place: null }} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(fetch).not.toHaveBeenCalled()
    expect(shown()).toBe('none')
  })

  it('is listed with no place, but draws nothing and fetches nothing', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      weather: { ...ON, place: null },
    }
    expect(widgetsFromSettings(settings).map(({ type }) => type)).toContain('weather')

    const { container } = render(<Probe settings={{ ...ON, place: null }} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(container.querySelector('.weather')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches and caches the weather when nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(12)))

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('12'))
    expect(await weatherCache.getValue()).toMatchObject({
      data: { temperature: 12 },
      key: cacheKey(PLACE, ON.unit),
    })
  })

  it('serves a fresh cache without asking again', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now(),
      key: cacheKey(PLACE, ON.unit),
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('5'))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows a stale cache, then the refreshed reading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(12)))
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      key: cacheKey(PLACE, ON.unit),
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('5'))
    await waitFor(() => expect(shown()).toBe('12'))
  })

  it('keeps a stale reading when the refresh fails', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      key: cacheKey(PLACE, ON.unit),
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(shown()).toBe('5')
  })

  it('drops a reading too old to be the weather now when the refresh fails', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now() - MAX_STALE_MS - 1,
      key: cacheKey(PLACE, ON.unit),
    })

    render(<Probe settings={ON} />)

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(shown()).toBe('none')
  })

  it('waits until the tab is looked at before asking', async () => {
    const fetch = vi.fn().mockResolvedValue(forecast(12))
    vi.stubGlobal('fetch', fetch)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)

    render(<Probe settings={ON} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(fetch).not.toHaveBeenCalled()

    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(shown()).toBe('12'))
    hidden.mockRestore()
  })

  it('shows nothing, cached or fetched, when the manifest switches the weather off', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await manifestCache.setValue({
      data: { ...makeManifest([makePhoto('a')]), weather: { enabled: false } },
      etag: null,
      fetchedAt: Date.now(),
    })
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now() - MAX_AGE_MS - 1,
      key: cacheKey(PLACE, ON.unit),
    })

    render(<Probe settings={ON} />)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(shown()).toBe('none')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a cache for another place or unit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(54)))
    await weatherCache.setValue({
      data: READING,
      fetchedAt: Date.now(),
      key: cacheKey(PLACE, 'celsius'),
    })

    render(<Probe settings={{ ...ON, unit: 'fahrenheit' }} />)

    await waitFor(() => expect(shown()).toBe('54'))
  })

  describe('following the device', () => {
    const FOLLOW: WeatherSettings = { ...ON, followDevice: true, place: null }
    const HERE = { latitude: 48.43, longitude: -123.37 }
    const AWAY = { latitude: 49.28, longitude: -123.12 }

    /** The browser's answers: whether location is allowed, and where the device is. */
    const device = (state: 'granted' | 'prompt', coords = HERE) => {
      const getCurrentPosition = vi.fn((done: (position: unknown) => void) => done({ coords }))
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition },
        language: 'en-CA',
        permissions: { query: () => Promise.resolve({ state }) },
      })
      return getCurrentPosition
    }

    /** Answers the forecast with a temperature, and the name lookup with a town (or a failure). */
    const answering = (temperature: number, city: string | null) => {
      const fetch = vi.fn((url: string) =>
        url.includes('reverse-geocode')
          ? Promise.resolve({ json: () => Promise.resolve({ city }), ok: city !== null })
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
        data: READING,
        fetchedAt: Date.now(),
        key: cacheKey({ name: '', ...position }, ON.unit),
      })

    /** The place the Weather says it is for: the location line is the only one shown. */
    const place = () => document.querySelector('.weather__details')?.textContent

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

    it('moves when settings pick the position again while the tab is open', async () => {
      device('prompt')
      answering(15, 'Vancouver')
      await devicePosition.setValue({ ...HERE, name: 'Victoria' })
      await cached(HERE)

      render(<Probe settings={FOLLOW} />)
      await waitFor(() => expect(shown()).toBe('5'))
      await devicePosition.setValue({ ...AWAY, name: 'Vancouver' })

      await waitFor(() => expect(shown()).toBe('15'))
      expect(place()).toBe('Vancouver')
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

describe('the Weather on Firefox', () => {
  /** Whether the user has agreed to send a place from this device. */
  const agreement = (agreed: boolean) => {
    vi.stubEnv('BROWSER', 'firefox')
    return vi.spyOn(browser.permissions, 'contains').mockResolvedValue(agreed as never)
  }

  it('fetches nothing until the user has agreed', async () => {
    const fetch = vi.fn().mockResolvedValue(forecast(12))
    vi.stubGlobal('fetch', fetch)
    const contains = agreement(false)

    render(<Probe settings={ON} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(contains).toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(shown()).toBe('none')
  })

  it('draws nothing and fetches nothing while the agreement is still being looked up', async () => {
    const fetch = vi.fn().mockResolvedValue(forecast(12))
    vi.stubGlobal('fetch', fetch)
    vi.stubEnv('BROWSER', 'firefox')
    let answer!: (agreed: boolean) => void
    vi.spyOn(browser.permissions, 'contains').mockReturnValue(
      new Promise<boolean>((resolve) => (answer = resolve)) as never,
    )

    render(<Probe settings={ON} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(shown()).toBe('none')

    await act(async () => {
      answer(true)
    })

    await waitFor(() => expect(shown()).toBe('12'))
  })

  it('fetches and draws the weather once the user has agreed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(forecast(12)))
    agreement(true)

    render(<Probe settings={ON} />)

    await waitFor(() => expect(shown()).toBe('12'))
  })

  it('asks the device nothing and looks up no name before the user has agreed, even when following it', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition },
      language: 'en-CA',
      permissions: { query: () => Promise.resolve({ state: 'granted' }) },
    })
    const fetch = vi.fn().mockResolvedValue(forecast(12))
    vi.stubGlobal('fetch', fetch)
    agreement(false)

    render(<Probe settings={{ ...ON, followDevice: true, place: null }} />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
