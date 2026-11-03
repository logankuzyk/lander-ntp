import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'

import type { WeatherSettings } from '@/settings/schema'
import { device, permissionEvents } from '@/test/permissions'
import { WidgetBox } from '@/widgetSystem/WidgetBox'

import { weatherDefinition } from './definition'

// The Weather's three needs, asked of the browser from the setup button and checked again when
// the tab is looked at or a permission changes. Drawn in a box of its own, with the browser's
// answers made up here; nothing real is asked.

const RECT = { col: 11, h: 2, row: 1, w: 2 }
const PAGE = { hour12: false }
const PLACE = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

/** Only the location line is shown, so the box says which place it is drawing. */
const ONLY_LOCATION: WeatherSettings['fields'] = [
  { id: 'location', shown: true },
  { id: 'highLow', shown: false },
  { id: 'sun', shown: false },
  { id: 'condition', shown: false },
  { id: 'feelsLike', shown: false },
]

const PICKED = { fields: ONLY_LOCATION, followDevice: false, place: PLACE, unit: 'celsius' }
const FOLLOWING = { fields: ONLY_LOCATION, followDevice: true, place: null, unit: 'celsius' }

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

/** The network: a forecast of 12 degrees, and Victoria as the town wherever the device is. */
function network() {
  const fetch = vi.fn((url: string) =>
    url.includes('reverse-geocode')
      ? Promise.resolve({ json: () => Promise.resolve({ city: 'Victoria' }), ok: true })
      : Promise.resolve(forecast(12)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/**
 * Firefox, with or without the user's agreement to send a place. The agreement is the browser's
 * to keep, so `request` records it when it is given and `contains` says whether it stands.
 */
function firefox(agreed: boolean) {
  vi.stubEnv('BROWSER', 'firefox')
  const state = { agreed }
  const contains = vi
    .spyOn(browser.permissions, 'contains')
    .mockImplementation((() => Promise.resolve(state.agreed)) as never)
  const request = vi.spyOn(browser.permissions, 'request').mockImplementation((() => {
    state.agreed = true
    return Promise.resolve(true)
  }) as never)
  return { contains, request, state }
}

const draw = (options: object) =>
  render(<WidgetBox definition={weatherDefinition} options={options} page={PAGE} rect={RECT} />)

const button = (label: string) => screen.findByRole('button', { name: `Weather, ${label}` })
const noButton = () => document.querySelector('.widget-setup') === null
const shown = () =>
  document.querySelector('.weather__temperature')?.textContent?.replace('°', '') ?? 'none'
/** Lets what the clicks and checks set going finish. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the Weather on Firefox, before the user has agreed to send a place', () => {
  it('draws a button for the agreement, and asks the device and the forecast for nothing', async () => {
    const fetch = network()
    const here = device('granted')
    firefox(false)

    draw(FOLLOWING)

    expect(await button('Allow sending your place')).toBeTruthy()
    await settle()
    expect(fetch).not.toHaveBeenCalled()
    expect(here.getCurrentPosition).not.toHaveBeenCalled()
    expect(shown()).toBe('none')
  })

  it('asks the browser for the agreement as the first thing the click does, before anything is awaited', async () => {
    network()
    const { request } = firefox(false)
    draw(PICKED)

    fireEvent.click(await button('Allow sending your place'))

    // No await between the click and this line: the prompt would not show otherwise.
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({ data_collection: ['locationInfo'] })
    await settle()
  })

  it('fetches and draws the forecast once the user agrees, and not before', async () => {
    const fetch = network()
    firefox(false)
    draw(PICKED)
    await button('Allow sending your place')
    expect(fetch).not.toHaveBeenCalled()

    fireEvent.click(await button('Allow sending your place'))

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the button, and fetches nothing, when the user says no', async () => {
    const fetch = network()
    const { request } = firefox(false)
    request.mockImplementation((() => Promise.resolve(false)) as never)
    draw(PICKED)

    fireEvent.click(await button('Allow sending your place'))
    await settle()

    expect(request).toHaveBeenCalledTimes(1)
    expect(await button('Allow sending your place')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('can be asked again after a no', async () => {
    network()
    const { request } = firefox(false)
    request.mockImplementationOnce((() => Promise.resolve(false)) as never)
    draw(PICKED)
    fireEvent.click(await button('Allow sending your place'))
    await settle()

    fireEvent.click(await button('Allow sending your place'))

    expect(request).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(shown()).toBe('12'))
  })

  it('can be asked again after the browser fails to ask', async () => {
    network()
    const { request } = firefox(false)
    request.mockImplementationOnce((() => Promise.reject(new Error('no prompt here'))) as never)
    draw(PICKED)
    fireEvent.click(await button('Allow sending your place'))
    await settle()

    fireEvent.click(await button('Allow sending your place'))

    expect(request).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(shown()).toBe('12'))
  })
})

describe('the Weather following the device', () => {
  it('asks for the location agreement first on Firefox, then for the location, and fetches nothing until both are given', async () => {
    const fetch = network()
    const here = device('prompt')
    firefox(false)
    draw(FOLLOWING)

    fireEvent.click(await button('Allow sending your place'))
    // A place is not needed (the device is followed), so the location is next.
    fireEvent.click(await button('Allow location'))
    expect(here.getCurrentPosition).toHaveBeenCalledTimes(1)
    await settle()
    expect(fetch).not.toHaveBeenCalled()
    expect(shown()).toBe('none')

    act(() => here.set('granted'))

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
  })

  it('draws a button for the location where it is not allowed, and does not ask the device', async () => {
    const fetch = network()
    const here = device('prompt')
    draw(FOLLOWING)

    expect(await button('Allow location')).toBeTruthy()
    await settle()
    expect(here.getCurrentPosition).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('asks the browser for the location as the first thing the click does, before anything is awaited', async () => {
    network()
    const here = device('prompt')
    draw(FOLLOWING)

    fireEvent.click(await button('Allow location'))

    expect(here.getCurrentPosition).toHaveBeenCalledTimes(1)
    await settle()
  })

  it('draws the forecast for where the device is once the location is allowed', async () => {
    const fetch = network()
    const here = device('prompt')
    draw(FOLLOWING)
    fireEvent.click(await button('Allow location'))
    await settle()

    act(() => here.set('granted'))

    await waitFor(() => expect(shown()).toBe('12'))
    expect(document.querySelector('.weather__details')?.textContent).toBe('Victoria')
    expect(fetch.mock.calls.filter(([url]) => url.includes('forecast'))).toHaveLength(1)
  })

  it('keeps the button when the browser says no', async () => {
    const fetch = network()
    const here = device('prompt')
    here.getCurrentPosition.mockImplementation(((_done: unknown, fail: (error: unknown) => void) =>
      fail({ code: 1 })) as never)
    draw(FOLLOWING)

    fireEvent.click(await button('Allow location'))
    await settle()

    expect(await button('Allow location')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not ask about the location for a place that was picked', async () => {
    network()
    const here = device('prompt')
    draw(PICKED)

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
    expect(here.getCurrentPosition).not.toHaveBeenCalled()
  })

  it('asks for a place before it asks for the location, when it follows nothing and has none', async () => {
    device('prompt')
    draw({ ...FOLLOWING, followDevice: false })

    expect(await button('Choose a place')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Weather, Allow location' })).toBeNull()
  })
})

describe('the Weather when a permission changes', () => {
  it('brings the location button back when the location is taken back, and stops following', async () => {
    const fetch = network()
    const here = device('granted')
    permissionEvents()
    draw(FOLLOWING)
    await waitFor(() => expect(shown()).toBe('12'))
    const requests = fetch.mock.calls.length

    act(() => here.set('prompt'))

    expect(await button('Allow location')).toBeTruthy()
    expect(shown()).toBe('none')
    await settle()
    expect(fetch).toHaveBeenCalledTimes(requests)
  })

  it('takes the button away when the location is allowed in the address bar instead', async () => {
    network()
    const here = device('prompt')
    permissionEvents()
    draw(FOLLOWING)
    await button('Allow location')

    act(() => here.set('granted'))

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
  })

  it('brings the agreement button back when Firefox takes the agreement back', async () => {
    const fetch = network()
    const events = permissionEvents()
    const { state } = firefox(true)
    draw(PICKED)
    await waitFor(() => expect(shown()).toBe('12'))
    const requests = fetch.mock.calls.length

    state.agreed = false
    act(() => events.fire('onRemoved'))

    expect(await button('Allow sending your place')).toBeTruthy()
    expect(shown()).toBe('none')
    await settle()
    expect(fetch).toHaveBeenCalledTimes(requests)
  })

  it('takes the agreement button away when Firefox is told the agreement was given elsewhere', async () => {
    network()
    const events = permissionEvents()
    const { state } = firefox(false)
    draw(PICKED)
    await button('Allow sending your place')

    state.agreed = true
    act(() => events.fire('onAdded'))

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
  })

  it('asks again when the tab comes back into view', async () => {
    network()
    permissionEvents()
    const { state } = firefox(false)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    draw(PICKED)
    await button('Allow sending your place')

    // Agreed in the add-on's settings while the tab was in the background.
    state.agreed = true
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await settle()
    expect(shown()).toBe('none')
    hidden.mockReturnValue(false)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(shown()).toBe('12'))
  })
})

describe('the Weather on a browser that does not ask for the agreement', () => {
  it('meets the agreement at once and never asks the browser about it', async () => {
    network()
    const contains = vi.spyOn(browser.permissions, 'contains')
    const request = vi.spyOn(browser.permissions, 'request')
    draw(PICKED)

    await waitFor(() => expect(shown()).toBe('12'))
    expect(noButton()).toBe(true)
    expect(contains).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })
})
