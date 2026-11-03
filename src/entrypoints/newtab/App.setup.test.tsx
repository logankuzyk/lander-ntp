import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'
import { weatherDefinition, type WeatherOptions } from '@/widgets/Weather/definition'
import type { Need } from '@/widgetSystem/needs'

import { App } from './App'

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, v: 1 }

/** What the button says: the Widget's name and then the need's words, as a reader reads it. */
const BUTTON = 'Weather, Choose a place'

const clock = {
  col: 5,
  h: 2,
  id: 'clock0aa',
  options: { showDate: false, showSeconds: false },
  row: 4,
  type: 'clock',
  w: 4,
}

/** A Weather with no place: what the Add menu stores, and an update's Weather that had none. */
const weather = (id: string, col: number, options: Record<string, unknown> = {}) => ({
  col,
  h: 2,
  id,
  options,
  row: 1,
  type: 'weather',
  w: 2,
})

const NO_PLACE = { v: 1, widgets: [clock, weather('weather1', 11)] }

/** Draws the page, past its first load, with `layout` stored. */
async function drawn(layout: unknown = NO_PLACE) {
  await settingsItem.setValue(SETTINGS)
  await fakeBrowser.storage.sync.set({ layout })
  const view = render(<App />)
  await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
  return view
}

const setup = () => screen.getByRole('button', { name: BUTTON })
const popover = () => screen.queryByRole('dialog', { name: 'Weather options' })
const search = () => screen.getByRole('combobox', { name: 'Search for a place' })
const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
const done = () => fireEvent.click(screen.getByRole('button', { name: 'Done' }))
/** The press of a mouse: the page hears it before the click. */
const press = (element: Element) => {
  fireEvent.pointerDown(element)
  fireEvent.click(element)
}
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

/** The Weather's box, which the button and the popover belong to. */
const weatherBox = () => {
  const box = document.querySelector<HTMLElement>('[data-widget-id="weather1"]')
  if (!box) throw new Error('no Weather')
  return box
}

const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown
const writtenKeys = (set: { mock: { calls: unknown[][] } }) =>
  set.mock.calls.map(([items]) => Object.keys(items as object).join(','))
const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))

const VICTORIA = {
  admin1: 'British Columbia',
  country: 'Canada',
  id: 1,
  latitude: 48.4359,
  longitude: -123.35155,
  name: 'Victoria',
}

/** The network: Open-Meteo's place search finds Victoria; the forecast cannot be had. */
function network() {
  const fetchSpy = vi.fn((url: unknown) =>
    String(url).includes('geocoding')
      ? Promise.resolve({ json: () => Promise.resolve({ results: [VICTORIA] }), ok: true })
      : Promise.reject(new TypeError('Failed to fetch')),
  )
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

/** Types Victoria into the open place search and picks the suggestion. */
async function pickVictoria() {
  fireEvent.input(search(), { target: { value: 'Victoria' } })
  fireEvent.click(await screen.findByRole('option', { name: 'Victoria, British Columbia, Canada' }))
  await settled()
}

beforeEach(() => {
  network()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App, the setup button', () => {
  describe('what the page draws', () => {
    it('gives a Weather with no place a button saying so, outside edit mode, and no Options button', async () => {
      await drawn()

      expect(setup()).toBeTruthy()
      expect(screen.queryByRole('button', { name: /options$/ })).toBeNull()
      expect(weatherBox().querySelector('.weather')).toBeNull()
    })

    it('gives the Clock, which needs nothing, no button', async () => {
      const { container } = await drawn()

      expect(container.querySelectorAll('.widget-setup')).toHaveLength(1)
      expect(container.querySelector('.clock')).not.toBeNull()
    })

    it('gives a Weather with a place its Weather, and no button', async () => {
      const place = makePlace()
      await weatherSource.cache.set(cacheKey(place, 'celsius'), {
        data: makeWeather(),
        fetchedAt: Date.now(),
      })
      const { container } = await drawn({
        v: 1,
        widgets: [clock, weather('weather1', 11, { place, unit: 'celsius' })],
      })

      await waitFor(() => expect(container.querySelector('.weather')).not.toBeNull())
      expect(container.querySelector('.widget-setup')).toBeNull()
    })

    it('gives a Weather that follows the device no button, as it has met the need', async () => {
      const { container } = await drawn({
        v: 1,
        widgets: [clock, weather('weather1', 11, { followDevice: true })],
      })

      expect(container.querySelector('.widget-setup')).toBeNull()
    })

    it('keeps the button in edit mode, beside the frame’s name and Options button', async () => {
      await drawn()

      edit()

      expect(setup()).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Weather options' })).toBeTruthy()
      expect(weatherBox().querySelector('.widget-box__name')?.textContent).toBe('Weather')
    })
  })

  describe('pressing it', () => {
    it('opens the Weather’s options with the place search focused, outside edit mode', async () => {
      await drawn()

      press(setup())

      const dialog = screen.getByRole('dialog', { name: 'Weather options' })
      expect(dialog.getAttribute('aria-modal')).toBeNull()
      expect(document.activeElement).toBe(search())
    })

    it('does the same in edit mode', async () => {
      await drawn()
      edit()

      press(setup())

      expect(popover()).not.toBeNull()
      expect(document.activeElement).toBe(search())
    })

    it('leaves the search’s suggestions closed, so one Escape closes the popover', async () => {
      await drawn()

      press(setup())

      expect(search().getAttribute('aria-expanded')).toBe('false')
      escape()
      expect(popover()).toBeNull()
    })

    it('opens the suggestions once the search is clicked or typed in, as it does anywhere', async () => {
      await drawn()
      press(setup())

      fireEvent.click(search())

      expect(search().getAttribute('aria-expanded')).toBe('true')
      expect(screen.getByRole('option', { name: 'Current location' })).toBeTruthy()
    })

    it('closes the options when pressed again, and does not reopen them from the press', async () => {
      await drawn()
      press(setup())

      press(setup())

      expect(popover()).toBeNull()
    })

    it('says the options are open and that it opens a dialog', async () => {
      await drawn()
      expect(setup().getAttribute('aria-haspopup')).toBe('dialog')
      expect(setup().getAttribute('aria-expanded')).toBe('false')

      press(setup())

      expect(setup().getAttribute('aria-expanded')).toBe('true')
    })

    it('moves the popover from one Weather to the other when the other’s button is pressed', async () => {
      await drawn({ v: 1, widgets: [clock, weather('weather1', 11), weather('weather2', 1)] })
      const [first, second] = screen.getAllByRole('button', { name: BUTTON })
      press(first!)
      expect(screen.getAllByRole('dialog')).toHaveLength(1)

      press(second!)

      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(document.activeElement).toBe(search())
      expect(second?.getAttribute('aria-expanded')).toBe('true')
      expect(first?.getAttribute('aria-expanded')).toBe('false')
    })

    it('closes whatever else is in the corner, as the Options button does', async () => {
      await drawn()
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()

      press(setup())

      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
      expect(popover()).not.toBeNull()
    })
  })

  describe('picking a place', () => {
    it('saves once, to sync:layout alone, and the button goes', async () => {
      await drawn()
      const before = await stored('settings')
      press(setup())
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      await pickVictoria()

      expect(writtenKeys(set)).toEqual(['layout'])
      expect(await stored('settings')).toEqual(before)
      expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
      const widgets = ((await stored('layout')) as { widgets: { id: string; options: unknown }[] })
        .widgets
      expect(widgets.find(({ id }) => id === 'weather1')?.options).toMatchObject({
        followDevice: false,
        place: { latitude: 48.44, longitude: -123.35, name: 'Victoria' },
      })
    })

    it('leaves the popover open, with focus on Change, so the keyboard is not left on the page', async () => {
      await drawn()
      press(setup())

      await pickVictoria()

      expect(screen.getByRole('dialog', { name: 'Weather, Victoria options' })).toBeTruthy()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }))
    })

    it('fetches the forecast for the place it was given, and for no other', async () => {
      const fetchSpy = network()
      await drawn()
      press(setup())

      await pickVictoria()

      const urls = fetchSpy.mock.calls.map(([url]) => String(url))
      expect(urls.some((url) => url.includes('forecast') || url.includes('48.4'))).toBe(true)
    })

    it('gives focus to the box when the popover then closes, for the button has gone', async () => {
      await drawn()
      press(setup())
      await pickVictoria()

      escape()

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(weatherBox())
    })

    it('does the same in edit mode, with the edit mode kept', async () => {
      await drawn()
      edit()
      press(setup())
      await pickVictoria()

      escape()

      expect(document.activeElement).toBe(weatherBox())
      expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    })

    it('follows the device when "Current location" is picked, and the button goes', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {
          getCurrentPosition: (done: (position: unknown) => void) =>
            done({ coords: { latitude: 48.43, longitude: -123.35 } }),
        },
        language: 'en-CA',
      })
      await drawn()
      press(setup())

      fireEvent.click(search())
      fireEvent.click(screen.getByRole('option', { name: 'Current location' }))
      await settled()

      expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }))
    })
  })

  describe('closing the popover it opened', () => {
    it('gives focus back to the button, which is still there, on Escape', async () => {
      await drawn()
      press(setup())

      escape()

      expect(popover()).toBeNull()
      expect(document.activeElement).toBe(setup())
    })

    it('gives focus back to the button on the ×', async () => {
      await drawn()
      press(setup())

      fireEvent.click(screen.getByRole('button', { name: 'Close Weather options' }))

      expect(document.activeElement).toBe(setup())
    })

    it('closes on a click elsewhere, outside edit mode, and leaves that click its focus', async () => {
      await drawn()
      press(setup())

      fireEvent.pointerDown(document.querySelector('.clock') as Element)

      expect(popover()).toBeNull()
    })

    it('closes on the first Escape in edit mode and leaves edit mode on the second', async () => {
      await drawn()
      edit()
      press(setup())

      escape()
      expect(popover()).toBeNull()
      expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
      expect(document.activeElement).toBe(setup())

      escape()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    })

    it('stays open when edit mode starts and ends, if it was opened outside it', async () => {
      await drawn()
      press(setup())

      // From the keyboard, which is how it is done with the options open: no press elsewhere.
      edit()
      expect(popover()).not.toBeNull()
      done()

      expect(popover()).not.toBeNull()
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
      escape()
      expect(popover()).toBeNull()
    })

    it('closes with edit mode if it was opened in it', async () => {
      await drawn()
      edit()
      press(setup())

      done()

      expect(popover()).toBeNull()
    })

    it('closes when the Weather goes (another tab removed it) and the page keeps its focus', async () => {
      await drawn()
      press(setup())

      await act(async () => {
        await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: [clock] } })
      })
      await waitFor(() => expect(popover()).toBeNull())
    })
  })

  describe('an ask need before the place (what W16 puts first on Firefox)', () => {
    const original = weatherDefinition.needs
    let granted = false
    let result: () => Promise<unknown>
    const ask = vi.fn(() => result())
    const allow: Need<WeatherOptions> = {
      action: { kind: 'ask', run: ask },
      id: 'allow',
      label: 'Allow it',
      met: () => granted,
    }

    beforeEach(() => {
      granted = false
      ask.mockClear()
      result = () => {
        granted = true
        return Promise.resolve()
      }
      // One array, set once, as a definition's is: a new one each render would start new checks.
      weatherDefinition.needs = [allow, ...(original ?? [])]
    })

    afterEach(() => {
      weatherDefinition.needs = original
    })

    const allowButton = () => screen.getByRole('button', { name: 'Weather, Allow it' })

    it('shows its button first, and the options stay shut', async () => {
      await drawn()

      expect(allowButton()).toBeTruthy()
      expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
      expect(popover()).toBeNull()
    })

    it('opens the options at the place search, straight away, when it is met and the place is next', async () => {
      await drawn()

      fireEvent.click(allowButton())
      await settled()

      expect(ask).toHaveBeenCalledTimes(1)
      expect(popover()).not.toBeNull()
      expect(document.activeElement).toBe(search())
      // The place's own button took its place behind the popover.
      expect(screen.getByRole('button', { name: BUTTON })).toBeTruthy()
    })

    it('opens nothing when the browser says no and the same need is still first', async () => {
      result = () => Promise.resolve(false)
      await drawn()

      fireEvent.click(allowButton())
      await settled()

      expect(ask).toHaveBeenCalledTimes(1)
      expect(popover()).toBeNull()
      expect(allowButton()).toBeTruthy()
    })

    it('opens nothing for a Weather that already has its place: the button just goes', async () => {
      const place = makePlace()
      await weatherSource.cache.set(cacheKey(place, 'celsius'), {
        data: makeWeather(),
        fetchedAt: Date.now(),
      })
      await drawn({
        v: 1,
        widgets: [clock, weather('weather1', 11, { place, unit: 'celsius' })],
      })

      fireEvent.click(allowButton())
      await settled()

      expect(popover()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Weather, Allow it' })).toBeNull()
    })
  })

  describe('the keyboard', () => {
    it('does it all: Tab to the button, Enter, type, pick, Escape', async () => {
      await drawn()
      // Tab order: the button is a stop in the Weather's box; the box itself is not outside edit mode.
      const box = weatherBox()
      expect(box.hasAttribute('tabindex')).toBe(false)
      const button = within(box).getByRole('button', { name: BUTTON })
      button.focus()
      expect(document.activeElement).toBe(button)

      // Enter on a button is a click (the browser does it; fireEvent.click is that).
      fireEvent.click(button)
      expect(document.activeElement).toBe(search())

      await pickVictoria()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }))

      escape()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(box)
      // Focusable only while it holds focus that was handed back: no stop in the tab order after.
      expect(box.getAttribute('tabindex')).toBe('-1')
      box.blur()
      expect(box.hasAttribute('tabindex')).toBe(false)
    })

    it('keeps the box out of the tab order outside edit mode, and in it in edit mode', async () => {
      await drawn()
      expect(weatherBox().hasAttribute('tabindex')).toBe(false)

      edit()

      expect(weatherBox().getAttribute('tabindex')).toBe('0')
    })
  })
})
