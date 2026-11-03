import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { formatTime } from '@/utils/time'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

const PLACE = makePlace()

/**
 * What the Weather's box and its popover are called: the box's name, with its place (see
 * `accessibleName`). The Options button is named for the type alone, "Weather options", as it is
 * read inside that box; the dialog stands outside it, so it carries the box's whole name.
 */
const WEATHER = 'Weather, Victoria'

/** Stored settings with the 24-hour clock, so a change to 12-hour time is easy to see. */
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, hour12: false },
  v: 1,
}

const clock = (id: string, col: number, options: Record<string, unknown> = {}) => ({
  col,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false, ...options },
  row: 4,
  type: 'clock',
  w: 4,
})

const weather = (options: Record<string, unknown> = {}) => ({
  col: 11,
  h: 2,
  id: 'weather1',
  options: { place: PLACE, unit: 'celsius', ...options },
  row: 1,
  type: 'weather',
  w: 2,
})

/** Two Clocks and a Weather: the Weather in the top right corner, where an update puts it. */
const THREE = {
  v: 1,
  widgets: [clock('clock0aa', 5), clock('clock0bb', 1), weather()],
}

/** Draws the page, past its first load, with `layout` stored (none: worked out from settings). */
async function drawn(layout?: unknown, settings: Settings = SETTINGS) {
  await settingsItem.setValue(settings)
  await weatherSource.cache.set(cacheKey(PLACE, 'celsius'), {
    data: makeWeather(),
    fetchedAt: Date.now(),
  })
  if (layout) await fakeBrowser.storage.sync.set({ layout })
  const view = render(<App />)
  await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
  return view
}

const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
const optionsButton = (name: string) => screen.getByRole('button', { name: `${name} options` })
const dialog = (name: string) => screen.queryByRole('dialog', { name: `${name} options` })
const open = (name: string) => fireEvent.click(optionsButton(name))
/** Opens the options of the Widget stored under this id (the page has two Clocks). */
const openById = (id: string) => {
  const box = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)
  if (!box) throw new Error(`no Widget ${id}`)
  fireEvent.click(within(box).getByRole('button', { name: / options$/ }))
}

/** What is stored in sync, by key. */
const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown

/** The keys of every write to sync storage so far, in order. */
const writtenKeys = (set: { mock: { calls: unknown[][] } }) =>
  set.mock.calls.map(([items]) => Object.keys(items as object).join(','))

/** Lets the save queue and the storage events settle. */
const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  // The spies on sync storage count every call since they were made, so each test makes its own.
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App, the options popover', () => {
  describe('opening and closing', () => {
    it('gives every Widget an Options button in edit mode, and none outside it', async () => {
      await drawn(THREE)
      expect(screen.queryByRole('button', { name: /options$/ })).toBeNull()

      edit()

      expect(screen.getAllByRole('button', { name: 'Clock options' })).toHaveLength(2)
      expect(optionsButton('Weather').getAttribute('aria-expanded')).toBe('false')
    })

    it('names the Options button for the Widget’s type and the dialog for its box', async () => {
      await drawn(THREE)
      edit()

      open('Weather')

      expect(optionsButton('Weather').getAttribute('aria-label')).toBe('Weather options')
      expect(screen.getByRole('dialog', { name: 'Weather, Victoria options' })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Weather, Victoria options' })).toBeTruthy()
    })

    it('opens a dialog labelled with the Widget’s name, focus on its first option', async () => {
      await drawn(THREE)
      edit()

      open('Weather')

      const popover = screen.getByRole('dialog', { name: `${WEATHER} options` })
      expect(popover.getAttribute('aria-modal')).toBeNull()
      expect(optionsButton('Weather').getAttribute('aria-expanded')).toBe('true')
      // The Weather's first option is its place, which shows the one it has.
      expect(popover.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).not.toBe(
        within(popover).getByRole('button', { name: /close/i }),
      )
    })

    it('opens the options of the Widget whose frame has focus when O is pressed', async () => {
      await drawn(THREE)
      edit()

      const frame = screen.getByRole('group', { name: WEATHER })
      frame.focus()
      fireEvent.keyDown(frame, { key: 'o' })

      expect(dialog(WEATHER)).not.toBeNull()
    })

    it('ignores O in a popover, with a modifier, or held down', async () => {
      await drawn(THREE)
      edit()
      const frame = screen.getByRole('group', { name: WEATHER })
      frame.focus()

      fireEvent.keyDown(frame, { ctrlKey: true, key: 'o' })
      fireEvent.keyDown(frame, { key: 'o', repeat: true })

      expect(dialog(WEATHER)).toBeNull()
    })

    it('closes with its ×, and focus goes back to the Widget', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.click(screen.getByRole('button', { name: `Close ${WEATHER} options` }))

      expect(dialog(WEATHER)).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('group', { name: WEATHER }))
    })

    it('closes with a click elsewhere, but not with a click inside it', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.pointerDown(screen.getByRole('dialog', { name: `${WEATHER} options` }))
      expect(dialog(WEATHER)).not.toBeNull()

      fireEvent.pointerDown(screen.getAllByRole('group', { name: 'Clock' })[0] as HTMLElement)
      expect(dialog(WEATHER)).toBeNull()
    })

    it('closes on the first Escape and leaves edit mode on the second', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
      expect(dialog(WEATHER)).toBeNull()
      expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    })

    it('closes when edit mode is left some other way', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(dialog(WEATHER)).toBeNull()
    })

    it('closes the one that is open when another Widget’s Options button is pressed, and opens that one', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      const [first] = screen.getAllByRole('button', { name: 'Clock options' })
      if (!first) throw new Error('no Clock')
      // A press first, as a pointer makes it: not a click elsewhere, which would close it twice.
      fireEvent.pointerDown(first)
      fireEvent.click(first)

      expect(dialog(WEATHER)).toBeNull()
      expect(dialog('Clock')).not.toBeNull()
    })

    it('closes when its own Options button is pressed again', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.pointerDown(optionsButton('Weather'))
      fireEvent.click(optionsButton('Weather'))

      expect(dialog(WEATHER)).toBeNull()
    })

    it('is never open together with the settings panel', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
      expect(dialog(WEATHER)).toBeNull()

      fireEvent.pointerDown(optionsButton('Weather'))
      fireEvent.click(optionsButton('Weather'))
      expect(dialog(WEATHER)).not.toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    })

    it('closes when its Widget goes, such as removed on another device', async () => {
      await drawn(THREE)
      edit()
      open('Weather')

      await act(async () => {
        await fakeBrowser.storage.sync.set({
          layout: { v: 1, widgets: [clock('clock0aa', 5)] },
        })
      })

      await waitFor(() => expect(dialog(WEATHER)).toBeNull())
    })

    it('ignores E, the arrows and Delete pressed inside it', async () => {
      await drawn(THREE)
      edit()
      openById('clock0aa')
      const inside = document.activeElement ?? document.body

      fireEvent.keyDown(inside, { key: 'e' })
      fireEvent.keyDown(inside, { key: 'ArrowRight' })
      fireEvent.keyDown(inside, { key: 'Delete' })

      expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
      expect(dialog('Clock')).not.toBeNull()
    })
  })

  describe('changing options', () => {
    it('saves one change as one write, to sync:layout alone', async () => {
      await drawn(THREE)
      const before = await stored('settings')
      edit()
      openById('clock0aa')
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show date' }))
      await settled()

      expect(writtenKeys(set)).toEqual(['layout'])
      expect(await stored('settings')).toEqual(before)
      const widgets = ((await stored('layout')) as { widgets: { id: string; options: unknown }[] })
        .widgets
      expect(widgets.find(({ id }) => id === 'clock0aa')?.options).toEqual({
        showDate: true,
        showSeconds: false,
      })
    })

    it('shows the change on the page at once', async () => {
      const { container } = await drawn(THREE)
      edit()
      openById('clock0aa')
      expect(container.querySelector('.clock__date')).toBeNull()

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show date' }))

      expect(container.querySelectorAll('.clock__date')).toHaveLength(1)
    })

    it('keeps the options of the Widgets it was not asked about, and keys it does not know', async () => {
      await drawn({
        v: 1,
        widgets: [
          {
            ...clock('clock0aa', 5),
            options: { future: [1, 2], showDate: false, showSeconds: false },
          },
          clock('clock0bb', 1, { showSeconds: true }),
        ],
      })
      edit()
      openById('clock0aa')

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show date' }))
      await settled()

      const saved = (await stored('layout')) as { widgets: { id: string; options: unknown }[] }
      expect(saved.widgets.map(({ id, options }) => [id, options])).toEqual([
        ['clock0aa', { future: [1, 2], showDate: true, showSeconds: false }],
        ['clock0bb', { showDate: false, showSeconds: true }],
      ])
    })

    it('gives two Clocks options of their own', async () => {
      await drawn(THREE)
      edit()
      const [first, second] = screen.getAllByRole('group', { name: 'Clock' })
      if (!first || !second) throw new Error('two Clocks expected')

      // Reading order: the Clock in column 1 comes before the one in column 5.
      fireEvent.click(within(first).getByRole('button', { name: 'Clock options' }))
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show seconds' }),
      )
      await settled()

      const saved = (await stored('layout')) as {
        widgets: { id: string; options: { showSeconds: boolean } }[]
      }
      expect(saved.widgets.map(({ id, options }) => [id, options.showSeconds])).toEqual([
        ['clock0aa', false],
        ['clock0bb', true],
        ['weather1', undefined],
      ])
    })

    it('stores the Layout worked out from the settings on the first change, with the Widgets that were on screen', async () => {
      await drawn(undefined, {
        ...SETTINGS,
        weather: { ...SETTINGS.weather, enabled: true, place: PLACE },
      })
      expect(await stored('layout')).toBeUndefined()
      edit()
      open('Clock')

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show date' }))
      await settled()

      const saved = (await stored('layout')) as { v: number; widgets: { type: string }[] }
      expect(saved.v).toBe(1)
      expect(saved.widgets.map(({ type }) => type).sort()).toEqual(['clock', 'weather'])
    })

    it('makes twenty quick changes in at most two writes', async () => {
      await drawn(THREE)
      edit()
      openById('clock0aa')
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      const showDate = within(screen.getByRole('dialog')).getByRole('switch', { name: 'Show date' })
      for (let flick = 0; flick < 20; flick++) fireEvent.click(showDate)
      await settled()

      expect(set.mock.calls.length).toBeGreaterThan(0)
      expect(set.mock.calls.length).toBeLessThanOrEqual(2)
      expect(writtenKeys(set).every((keys) => keys === 'layout')).toBe(true)
    })

    it('writes nothing for a change that changes nothing', async () => {
      await drawn(THREE)
      edit()
      open('Weather')
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      // Units: choosing Celsius again, while it is Celsius.
      fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
      fireEvent.click(screen.getByRole('option', { name: 'Celsius' }))
      await settled()

      expect(set).not.toHaveBeenCalled()
    })
  })

  describe('the 24-hour switch, which is the page’s', () => {
    it('writes clock.hour12 to the settings and nothing to the Layout, and every Clock follows', async () => {
      const { container } = await drawn(THREE)
      const layoutBefore = await stored('layout')
      edit()
      open('Weather')
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('switch', { name: '24-hour time' }),
      )
      await settled()

      expect(writtenKeys(set)).toEqual(['settings'])
      const settings = (await stored('settings')) as Settings
      expect(settings.clock.hour12).toBe(true)
      expect(settings).toEqual({ ...SETTINGS, clock: { ...SETTINGS.clock, hour12: true } })
      expect(await stored('layout')).toEqual(layoutBefore)
      const times = [...container.querySelectorAll('.clock__time')]
      expect(times).toHaveLength(2)
      for (const time of times) {
        const at = new Date(time.getAttribute('datetime') ?? '')
        expect(time.textContent).toBe(formatTime(at, { hour12: true, showSeconds: false }))
      }
      // And a Clock's own options say so too: the page value is not one Widget's.
      fireEvent.pointerDown(optionsButton('Weather'))
      openById('clock0aa')
      const hours = within(screen.getByRole('dialog', { name: 'Clock options' })).getByRole(
        'switch',
        {
          name: '24-hour time',
        },
      ) as HTMLInputElement
      expect(hours.checked).toBe(false)
    })

    it('starts from the settings as stored now, so another tab’s font change is not overwritten', async () => {
      await drawn(THREE)
      edit()
      open('Weather')
      // Another tab chose a font; this one has not heard of it yet.
      const spy = vi.spyOn(settingsItem, 'getValue').mockResolvedValue({
        ...SETTINGS,
        font: 'instrument-serif',
      })

      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('switch', { name: '24-hour time' }),
      )
      await settled()
      spy.mockRestore()

      const settings = (await stored('settings')) as Settings
      expect(settings.font).toBe('instrument-serif')
      expect(settings.clock.hour12).toBe(true)
    })
  })

  describe('when the Layout is from a newer version', () => {
    it('opens with its controls off and saves nothing', async () => {
      await drawn({ v: 2, widgets: [clock('clock0aa', 5)] })
      edit()
      openById('clock0aa')
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      const showDate = within(screen.getByRole('dialog')).getByRole('switch', {
        name: 'Show date',
      }) as HTMLInputElement
      expect(showDate.disabled).toBe(true)
      fireEvent.click(showDate)
      await settled()

      expect(set).not.toHaveBeenCalled()
    })
  })
})
