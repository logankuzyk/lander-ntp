import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { layoutItem } from '@/layout/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

const PLACE = makePlace()

/**
 * Settings as v0.2.3 stores them: no `v`, the Clock and the Weather each on or off. The kept
 * options are not the defaults, so that the Widget added from them can be told by them.
 */
const v023 = ({ clock, weather }: { clock: boolean; weather: boolean }): Settings => ({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, enabled: clock, showDate: true, showSeconds: true },
  weather: {
    ...DEFAULT_SETTINGS.weather,
    enabled: weather,
    place: PLACE,
    unit: 'fahrenheit',
  },
})

/** Draws the page, past its first load, from v0.2.3's settings (no Layout stored). */
async function drawn(settings: Settings, layout?: unknown) {
  await settingsItem.setValue(settings)
  await weatherSource.cache.set(cacheKey(PLACE, 'fahrenheit'), {
    data: makeWeather(),
    fetchedAt: Date.now(),
  })
  if (layout) await fakeBrowser.storage.sync.set({ layout })
  const view = render(<App />)
  await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
  return view
}

const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
const add = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name }))
}
const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown
const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))
const writtenKeys = (set: { mock: { calls: unknown[][] } }) =>
  set.mock.calls.map(([items]) => Object.keys(items as object).join(','))

type Stored = {
  waiting?: Record<string, unknown>
  widgets: {
    col: number
    h: number
    id: string
    options: Record<string, unknown>
    row: number
    type: string
    w: number
  }[]
}

/** The box of the Widget stored last (the one just added), by the id it is stored under. */
const newestBox = async () => {
  const { widgets } = (await stored('layout')) as Stored
  const id = widgets[widgets.length - 1]?.id
  const box = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)
  if (!box) throw new Error('the new Widget is not on the page')
  return box
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App, adding a Widget from the Add menu', () => {
  it('adds a Weather in the free place nearest the middle', async () => {
    await drawn(v023({ clock: true, weather: false }))
    edit()

    add('Weather')
    await settled()

    // The Clock (with seconds) is on rows 4 and 5, so the nearest free 2 by 2 is the one above,
    // in the middle columns: of the two equally near, the upper is taken.
    const box = await newestBox()
    expect(box.dataset.widget).toBe('weather')
    expect([box.style.gridColumn, box.style.gridRow]).toEqual(['6 / span 2', '2 / span 2'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the setup button for a Weather that has no place', async () => {
    // A new install: nothing stored, the defaults, and no place.
    await settingsItem.setValue(DEFAULT_SETTINGS)
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    edit()

    add('Weather')
    await settled()

    const box = await newestBox()
    expect(within(box).getByRole('button', { name: /Weather.*Choose a place/ })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('puts focus on the new Widget’s frame', async () => {
    await drawn(v023({ clock: true, weather: true }))
    edit()

    add('Clock')
    await settled()

    const box = await newestBox()
    expect(box.dataset.widget).toBe('clock')
    expect(document.activeElement).toBe(box)
  })

  it('lets Escape close the Add menu before clearing the selected Widget', async () => {
    await drawn(v023({ clock: true, weather: true }))
    edit()
    const clock = screen.getByRole('group', { name: 'Clock' })
    fireEvent.click(clock)
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const menu = screen.getByRole('menu')
    const firstItem = within(menu).getAllByRole('menuitem')[0]!

    fireEvent.keyDown(firstItem, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(clock.dataset.selected).toBe('true')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(clock.dataset.selected).toBe('false')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('writes sync:layout once, and nothing else', async () => {
    await drawn(v023({ clock: true, weather: true }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    edit()

    add('Clock')
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(await stored('onboarding')).toBeUndefined()
  })

  it('allows two Weathers', async () => {
    await drawn(v023({ clock: true, weather: false }))
    edit()

    add('Weather')
    await settled()
    // The new Weather has the focus, not the Add button: edit mode is still on.
    add('Weather')
    await settled()

    const { widgets } = (await stored('layout')) as Stored
    expect(widgets.filter(({ type }) => type === 'weather')).toHaveLength(2)
    expect(document.querySelectorAll('.widget-box[data-widget="weather"]')).toHaveLength(2)
  })

  it('says there is no room when the Grid is full, and adds nothing', async () => {
    const clock = (id: string, col: number, row: number, w: number) => ({
      col,
      h: 4,
      id,
      options: { showDate: false, showSeconds: false },
      row,
      type: 'clock',
      w,
    })
    await drawn(v023({ clock: true, weather: true }), {
      v: 1,
      widgets: [
        clock('clock0aa', 1, 1, 8),
        clock('clock0bb', 9, 1, 4),
        clock('clock0cc', 1, 5, 8),
        clock('clock0dd', 9, 5, 4),
      ],
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    edit()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Weather/ }))
    await settled()

    expect(screen.getByRole('menuitem', { name: /Weather/ }).textContent).toContain(
      'There is no room for a Weather.',
    )
    expect(set).not.toHaveBeenCalled()
  })

  it('opens the menu with the A key in edit mode', async () => {
    await drawn(v023({ clock: true, weather: true }))
    edit()

    fireEvent.keyDown(window, { key: 'a' })

    expect(screen.getByRole('menu', { name: 'Add a widget' })).toBeTruthy()
  })

  it('closes an open options popover when Add is pressed', async () => {
    await drawn(v023({ clock: true, weather: true }))
    edit()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    const addButton = screen.getByRole('button', { name: 'Add' })
    fireEvent.pointerDown(addButton)
    fireEvent.click(addButton)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('menu')).toBeTruthy()
  })
})

describe('App, an add the browser rejects', () => {
  it('puts focus back on Add, says nothing was added, and says the save failed', async () => {
    await drawn(v023({ clock: true, weather: false }))
    vi.spyOn(layoutItem, 'setValue').mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM'))
    edit()

    add('Weather')
    await settled()

    // The Widget went with the save: the Layout is the one that is stored.
    expect(document.querySelector('.widget-box[data-widget="weather"]')).toBeNull()
    // Focus was on the new Widget's frame, which is gone: it is on Add, not on the page.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add' }))
    const live = [...document.querySelectorAll('[aria-live="polite"]')].map((el) => el.textContent)
    expect(live.join('')).not.toContain('Weather added.')
    expect(screen.getByRole('status').textContent).toContain("Couldn't save that")
  })

  it('keeps the line and the focus when the save goes through', async () => {
    await drawn(v023({ clock: true, weather: false }))
    edit()

    add('Weather')
    await settled()

    const box = await newestBox()
    expect(document.activeElement).toBe(box)
    const live = [...document.querySelectorAll('[aria-live="polite"]')].map((el) => el.textContent)
    expect(live.join('')).toContain('Weather added.')
  })
})

describe('App, adding back what an update from v0.2.3 left off', () => {
  /**
   * The Clock and the Weather as a v0.2.3 install may have them: each off or on. What is off
   * is kept as waiting options, and adding that type uses them once.
   */
  it('adds the Clock back when it was off, with the options it had, and uses them up', async () => {
    await drawn(v023({ clock: false, weather: true }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    expect(document.querySelector('.widget-box[data-widget="clock"]')).toBeNull()
    edit()

    add('Clock')
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    const layout = (await stored('layout')) as Stored
    const clock = layout.widgets.find(({ type }) => type === 'clock')
    expect(clock?.options).toEqual({ showDate: true, showSeconds: true })
    // The Clock's waiting options are used up in the same save, and the Weather was on.
    expect(layout.waiting).toEqual(undefined)
    // The first Layout write stores the Weather that was on screen, too.
    expect(layout.widgets.map(({ type }) => type).sort()).toEqual(['clock', 'weather'])
    // sync:settings is untouched: the Clock's `enabled` is never written.
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(document.querySelector('.widget-box[data-widget="clock"]')).not.toBeNull()
  })

  it('adds the Weather back when it was off, from the options it had, and a second one from the defaults', async () => {
    await drawn(v023({ clock: true, weather: false }))
    edit()

    add('Weather')
    await settled()
    add('Weather')
    await settled()

    const layout = (await stored('layout')) as Stored
    const weathers = layout.widgets.filter(({ type }) => type === 'weather')
    expect(weathers).toHaveLength(2)
    expect(weathers[0]?.options).toMatchObject({ place: PLACE, unit: 'fahrenheit' })
    expect(weathers[1]?.options).toMatchObject({ place: null })
    expect(layout.waiting).toBeUndefined()
  })

  it('adds both back when both were off, from an empty Grid, each from its own options', async () => {
    await drawn(v023({ clock: false, weather: false }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    expect(document.querySelectorAll('.widget-box')).toHaveLength(0)
    edit()

    add('Clock')
    await settled()
    const afterClock = (await stored('layout')) as Stored
    // The Weather's options are still waiting; the Clock's are used up.
    expect(Object.keys(afterClock.waiting ?? {})).toEqual(['weather'])
    add('Weather')
    await settled()

    expect(writtenKeys(set)).toEqual(['layout', 'layout'])
    const layout = (await stored('layout')) as Stored
    expect(layout.widgets.map(({ type }) => type)).toEqual(['clock', 'weather'])
    expect(layout.waiting).toBeUndefined()
    expect(layout.widgets[0]).toMatchObject({ col: 4, row: 4, type: 'clock', w: 6 })
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(document.querySelectorAll('.widget-box')).toHaveLength(2)
  })
})

describe('App, at the Widget limit', () => {
  const LINE = "That's all 8 widgets. Remove one to add another."

  const weatherAt = (n: number, col: number, row: number) => ({
    col,
    h: 2,
    id: `weather${n}`,
    options: {},
    row,
    type: 'weather',
    w: 2,
  })

  /** Eight Weathers along the top and bottom edges, the middle free; more when asked. */
  const storedWidgets = (...extra: unknown[]) => [
    weatherAt(1, 1, 1),
    weatherAt(2, 3, 1),
    weatherAt(3, 9, 1),
    weatherAt(4, 11, 1),
    weatherAt(5, 1, 7),
    weatherAt(6, 3, 7),
    weatherAt(7, 9, 7),
    weatherAt(8, 11, 7),
    ...extra,
  ]

  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  const menuLine = () => document.querySelector('.add-menu__note')?.textContent ?? null
  const clockItem = () => screen.getByRole('menuitem', { name: 'Clock' })
  const removeWidgetBox = (id: string) => {
    const box = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)
    if (!box) throw new Error(`no Widget ${id}`)
    fireEvent.click(within(box).getByRole('button', { name: /^Remove / }))
  }

  it('adds nothing at eight, says why in the menu, and writes nothing', async () => {
    await drawn(v023({ clock: true, weather: true }), { v: 1, widgets: storedWidgets() })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    edit()

    openMenu()
    fireEvent.click(clockItem())
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Weather' }), { key: 'Enter' })
    await settled()

    expect(menuLine()).toBe(LINE)
    expect(clockItem().getAttribute('aria-disabled')).toBe('true')
    expect(set).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.widget-box')).toHaveLength(8)
  })

  it('shows nothing before the limit: at seven the menu has no line', async () => {
    await drawn(v023({ clock: true, weather: true }), {
      v: 1,
      widgets: storedWidgets().slice(0, 7),
    })
    edit()

    openMenu()

    expect(menuLine()).toBeNull()
    expect(clockItem().getAttribute('aria-disabled')).toBeNull()
  })

  it('loads nine whole, draws all nine, writes nothing, and keeps adding off', async () => {
    await drawn(v023({ clock: true, weather: true }), {
      v: 1,
      widgets: storedWidgets(weatherAt(9, 5, 7)),
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    edit()

    expect(document.querySelectorAll('.widget-box')).toHaveLength(9)
    openMenu()
    expect(menuLine()).toBe(LINE)
    await settled()
    expect(set).not.toHaveBeenCalled()
    expect(((await stored('layout')) as Stored).widgets).toHaveLength(9)
  })

  it('adds again once one is removed, and stops again at eight', async () => {
    await drawn(v023({ clock: true, weather: true }), { v: 1, widgets: storedWidgets() })
    edit()
    removeWidgetBox('weather5')
    await settled()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    openMenu()
    expect(menuLine()).toBeNull()
    fireEvent.click(clockItem())
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(((await stored('layout')) as Stored).widgets).toHaveLength(8)
    openMenu()
    expect(menuLine()).toBe(LINE)
  })

  it('does not count a malformed Widget, which nothing on the page can remove', async () => {
    const malformed = { col: 'x', h: 1, id: 'badbad00', options: {}, row: 1, type: 'clock', w: 1 }
    // Seven Weathers that are drawn, and one that is not.
    await drawn(v023({ clock: true, weather: true }), {
      v: 1,
      widgets: [...storedWidgets().slice(0, 7), malformed],
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    edit()

    openMenu()
    expect(menuLine()).toBeNull()
    fireEvent.click(clockItem())
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    // Kept as it was stored, with the new Widget beside it.
    const { widgets } = (await stored('layout')) as Stored
    expect(widgets).toContainEqual(malformed)
    expect(widgets).toHaveLength(9)
  })
})
