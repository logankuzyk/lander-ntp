import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { device, permissionEvents } from '@/test/permissions'

import { App } from './App'

// On Firefox nothing is sent anywhere until the user has agreed to it: not the forecast, and not
// what is typed into the place search or the device's position either. The options popover is
// another way into the place search, so it is held back too, and says why.

const clock = {
  col: 5,
  h: 2,
  id: 'clock0aa',
  options: { showDate: false, showSeconds: false },
  row: 4,
  type: 'clock',
  w: 4,
}
const weather = { col: 11, h: 2, id: 'weather1', options: {}, row: 1, type: 'weather', w: 2 }

const VICTORIA = {
  admin1: 'British Columbia',
  country: 'Canada',
  id: 1,
  latitude: 48.4359,
  longitude: -123.35155,
  name: 'Victoria',
}

/** Every request the page makes, answered as Open-Meteo's place search would. */
function network() {
  const fetch = vi.fn((url: unknown) =>
    String(url).includes('geocoding')
      ? Promise.resolve({ json: () => Promise.resolve({ results: [VICTORIA] }), ok: true })
      : Promise.reject(new TypeError('Failed to fetch')),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

/** Firefox, where the user has or has not agreed to send a place. */
function firefox(agreed: boolean) {
  vi.stubEnv('BROWSER', 'firefox')
  const state = { agreed }
  vi.spyOn(browser.permissions, 'contains').mockImplementation((() =>
    Promise.resolve(state.agreed)) as never)
  const request = vi.spyOn(browser.permissions, 'request').mockImplementation((() => {
    state.agreed = true
    return Promise.resolve(true)
  }) as never)
  return { request, state }
}

/** The page with a Weather that has no place, in edit mode, with its options open. */
async function withOptionsOpen() {
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, v: 1 })
  await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: [clock, weather] } })
  render(<App />)
  await screen.findByRole('group', { name: 'Weather' })
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Weather options' }))
  return screen.getByRole('dialog', { name: 'Weather options' })
}

const search = () =>
  screen.getByRole('combobox', { name: 'Search for a place' }) as HTMLInputElement
const geocoding = (fetch: ReturnType<typeof network>) =>
  fetch.mock.calls.filter(([url]) => String(url).includes('geocoding'))
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))

let fetch: ReturnType<typeof network>
let here: ReturnType<typeof device>

beforeEach(() => {
  fetch = network()
  here = device('granted')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('style')
})

describe('the options popover before the user has agreed to send a place, on Firefox', () => {
  it('holds the place search back, and says why', async () => {
    firefox(false)
    const dialog = await withOptionsOpen()

    await waitFor(() => expect(search().disabled).toBe(true))
    expect(within(dialog).getByRole('button', { name: 'Allow sending your place' })).toBeTruthy()
    expect(dialog.textContent).toContain('Do this first to set the place.')
  })

  it('sends nothing to the place search, however the text gets into it', async () => {
    firefox(false)
    await withOptionsOpen()
    await waitFor(() => expect(search().disabled).toBe(true))

    fireEvent.input(search(), { target: { value: 'Victoria' } })
    await wait(400)

    expect(geocoding(fetch)).toEqual([])
  })

  it('does not offer the device’s location, and asks the device nothing, however the box is pressed', async () => {
    firefox(false)
    await withOptionsOpen()
    await waitFor(() => expect(search().disabled).toBe(true))

    fireEvent.click(search())
    fireEvent.focus(search())
    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    await wait(50)

    expect(screen.queryByRole('option', { name: 'Current location' })).toBeNull()
    expect(here.getCurrentPosition).not.toHaveBeenCalled()
    // Nothing but the page's own photo list, which has nothing to do with a place.
    expect(fetch.mock.calls.filter(([url]) => !String(url).includes('photos.json'))).toEqual([])
  })

  it('asks the browser for the agreement from the popover’s button, as the first thing the click does', async () => {
    const { request } = firefox(false)
    const dialog = await withOptionsOpen()

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Allow sending your place' }))

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({ data_collection: ['locationInfo'] })
    await wait(30)
  })

  it('lets the place be searched once the user has agreed, and the Weather’s own button moves on', async () => {
    firefox(false)
    const dialog = await withOptionsOpen()
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Allow sending your place' }))
    await wait(50)

    await waitFor(() => expect(search().disabled).toBe(false))
    expect(within(dialog).queryByRole('button', { name: 'Allow sending your place' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Weather, Allow sending your place' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Weather, Choose a place' })).toBeTruthy()
    fireEvent.input(search(), { target: { value: 'Victoria' } })
    await waitFor(() => expect(geocoding(fetch)).toHaveLength(1))
  })

  it('holds the search back again when the agreement is taken back while the popover is open', async () => {
    const events = permissionEvents()
    const { state } = firefox(true)
    await withOptionsOpen()
    await waitFor(() => expect(search().disabled).toBe(false))

    state.agreed = false
    act(() => events.fire('onRemoved'))

    await waitFor(() => expect(search().disabled).toBe(true))
    fireEvent.input(search(), { target: { value: 'Victoria' } })
    await wait(400)
    expect(geocoding(fetch)).toEqual([])
  })

  it('leaves the other options alone: the units can be changed without the agreement', async () => {
    firefox(false)
    const dialog = await withOptionsOpen()
    await waitFor(() => expect(search().disabled).toBe(true))

    const units = within(dialog).getByRole('combobox', { name: 'Units' }) as HTMLButtonElement
    expect(units.disabled).toBe(false)
  })
})

describe('the options popover on a browser that does not ask for the agreement', () => {
  it('draws the place search as it was, with nothing to allow first', async () => {
    const request = vi.spyOn(browser.permissions, 'request')
    const dialog = await withOptionsOpen()

    expect(search().disabled).toBe(false)
    expect(within(dialog).queryByRole('button', { name: /allow/i })).toBeNull()
    expect(dialog.textContent).not.toContain('Do this first')
    expect(request).not.toHaveBeenCalled()
  })
})
