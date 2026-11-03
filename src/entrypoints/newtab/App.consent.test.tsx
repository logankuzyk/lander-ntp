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
const searchOrNull = () => screen.queryByRole('combobox', { name: 'Search for a place' })
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

describe('where focus goes when the options open at the place, on Firefox', () => {
  /** Lets the page settle a few ticks at a time (effects run inside `act`), until `done` holds. */
  async function until(done: () => boolean) {
    for (let tick = 0; tick < 60 && !done(); tick++) await wait(5)
  }

  it('is the place search, once the agreement is looked up and the search is let through', async () => {
    firefox(true)
    await withOptionsOpen()

    await until(() => !search().disabled)

    expect(search().disabled).toBe(false)
    expect(document.activeElement).toBe(search())
  })

  it('is the place search after the Weather’s own "Choose a place" button is pressed', async () => {
    firefox(true)
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, v: 1 })
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: [clock, weather] } })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Weather, Choose a place' }))
    await until(() => document.activeElement === searchOrNull())

    expect(search().disabled).toBe(false)
    expect(document.activeElement).toBe(search())
  })

  it('is the place search after "Allow sending your place" is pressed and the place is next', async () => {
    firefox(false)
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, v: 1 })
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: [clock, weather] } })
    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Weather, Allow sending your place' }),
    )
    await until(() => document.activeElement === searchOrNull())

    expect(document.activeElement).toBe(search())
  })
})

describe('the settings panel before the user has agreed to send a place, on Firefox', () => {
  // Until the Clock and Weather options left the panel, its place search sent whatever was typed
  // to the geocoder, whether or not this device had agreed to it: the agreement is not synced,
  // and "Weather on" is. The panel has no place search now, and the options popover, where it
  // is, holds it back (above). This is the check that no way into one is left in the panel.

  /** The settings of a device where the Weather was turned on, with or without a place. */
  const syncedOn = (place: unknown) =>
    settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      v: 1,
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: place as never },
    })

  const textBoxes = (root: HTMLElement) =>
    root.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]), [role="combobox"]')

  it.each([
    ['with no place yet', null],
    ['with a place', { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' }],
  ])('has no place search and sends nothing, however it is used, %s', async (_, place) => {
    const { request } = firefox(false)
    await syncedOn(place)
    render(<App />)
    await waitFor(() => expect(document.querySelector('.grid')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const panel = await screen.findByRole('dialog', { name: 'Settings' })

    // Every section there is, whichever they are.
    for (const tab of within(panel).getAllByRole('tab')) {
      fireEvent.click(tab)
      expect(searchOrNull()).toBeNull()
      expect(
        within(panel).queryByRole('button', { name: /current location|change place/i }),
      ).toBeNull()
      // Whatever text box or search the panel does have is typed in, and the page waits for any
      // debounced search to go out.
      for (const box of textBoxes(panel)) {
        fireEvent.focus(box)
        fireEvent.input(box, { target: { value: 'Victoria' } })
        fireEvent.keyDown(box, { key: 'ArrowDown' })
      }
      await wait(400)
    }

    expect(geocoding(fetch)).toEqual([])
    expect(here.getCurrentPosition).not.toHaveBeenCalled()
    // And nothing in the panel asks for the agreement either: that is the widget's button.
    expect(request).not.toHaveBeenCalled()
  })
})
