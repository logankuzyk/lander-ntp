import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

// The page, dragged by a person's pointer, against the fake browser's storage: what a drag writes,
// and where, and what it does to the options popover. happy-dom measures nothing, so the Grid is
// said to be 1200 by 800 pixels at the window's top left: a cell is 100 by 100.
const GRID = { height: 800, left: 0, top: 0, width: 1200 }
const PLACE = makePlace()
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, v: 1 }

const LAYOUT = {
  v: 1,
  widgets: [
    {
      col: 5,
      h: 2,
      id: 'clock0aa',
      options: { showDate: false, showSeconds: false },
      row: 4,
      type: 'clock',
      w: 4,
    },
    {
      col: 11,
      h: 2,
      id: 'weather1',
      options: { place: PLACE, unit: 'celsius' },
      row: 1,
      type: 'weather',
      w: 2,
    },
  ],
}

async function drawn(layout: unknown = LAYOUT) {
  await settingsItem.setValue(SETTINGS)
  await weatherSource.cache.set(cacheKey(PLACE, 'celsius'), {
    data: makeWeather(),
    fetchedAt: Date.now(),
  })
  await fakeBrowser.storage.sync.set({ layout })
  const view = render(<App />)
  await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  return view
}

const box = (type: string) => {
  const found = document.querySelector<HTMLElement>(`.widget-box[data-widget="${type}"]`)
  if (!found) throw new Error(`no ${type}`)
  return found
}

const MOUSE = { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' }
const press = (el: Element, x: number, y: number) =>
  fireEvent.pointerDown(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const drag = (el: Element, x: number, y: number) =>
  fireEvent.pointerMove(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const release = (el: Element, x: number, y: number) =>
  fireEvent.pointerUp(el, { ...MOUSE, clientX: x, clientY: y })

/** What is stored in sync, by key. */
const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown

type StoredWidget = { col: number; id: string; row: number }
const placeInStorage = async (id: string) => {
  const layout = (await stored('layout')) as { widgets: StoredWidget[] }
  const widget = layout.widgets.find((candidate) => candidate.id === id)
  return widget && { col: widget.col, row: widget.row }
}

/** The keys of every write to sync storage so far, in order. */
const writtenKeys = (set: { mock: { calls: unknown[][] } }) =>
  set.mock.calls.map(([items]) => Object.keys(items as object).join(','))

/** Lets the save queue and the storage events settle. */
const settled = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = this.classList.contains('grid') ? GRID : { height: 0, left: 0, top: 0, width: 0 }
    return {
      ...r,
      bottom: r.top + r.height,
      right: r.left + r.width,
      x: r.left,
      y: r.top,
    } as DOMRect
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(async () => {
  // A drag swallows the click that follows it until the next task.
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('App, dragging a Widget', () => {
  it('writes sync:layout once for a drop, and nothing else, none while the pointer moves', async () => {
    await drawn()
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')

    press(clock, 450, 350)
    for (let step = 1; step <= 20; step++) drag(clock, 450 - step * 5, 350)
    await settled()
    expect(set).not.toHaveBeenCalled()

    release(clock, 350, 350)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await placeInStorage('clock0aa')).toEqual({ col: 4, row: 4 })
    expect(await placeInStorage('weather1')).toEqual({ col: 11, row: 1 })
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(box('clock').style.gridColumn).toBe('4 / span 4')
    expect(box('clock').style.transform).toBe('')
  })

  it('writes the Layout worked out from the settings, with the Widget moved, on the first drop', async () => {
    // No stored Layout: the Clock's place is worked out, and the first change stores it all.
    await settingsItem.setValue(SETTINGS)
    const view = render(<App />)
    await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    const clock = box('clock')
    press(clock, 450, 350)
    drag(clock, 150, 350)
    release(clock, 150, 350)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await placeInStorage(box('clock').dataset.widgetId!)).toEqual({ col: 2, row: 4 })
    expect(await stored('settings')).toEqual(settingsBefore)
  })

  it('writes nothing for a refused drop, an Escape, or a press that did not move', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')

    // Onto the Weather.
    press(clock, 450, 350)
    drag(clock, 1150, 50)
    release(clock, 1150, 50)
    // Escape.
    press(clock, 450, 350)
    drag(clock, 250, 350)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    release(clock, 250, 350)
    // A press.
    press(clock, 450, 350)
    release(clock, 450, 350)
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
  })

  it('makes at most two writes for twenty flicks in a row', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    // The Clock a column to the right and back, twenty times, as quickly as events come.
    for (let flick = 0; flick < 20; flick++) {
      const clock = box('clock')
      const from = flick % 2 === 0 ? 450 : 550
      const to = flick % 2 === 0 ? 550 : 450
      press(clock, from, 350)
      drag(clock, to, 350)
      release(clock, to, 350)
    }
    await settled()

    expect(set.mock.calls.length).toBeLessThanOrEqual(2)
    expect(writtenKeys(set).every((keys) => keys === 'layout')).toBe(true)
    // And it ended where the last flick left it: back where it began.
    expect(await placeInStorage('clock0aa')).toEqual({ col: 5, row: 4 })
  })

  it('does nothing to a Layout a newer version wrote, and writes nothing', async () => {
    await drawn({ ...LAYOUT, v: 2 })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')

    expect(document.querySelector('.grid--movable')).toBeNull()
    press(clock, 450, 350)
    drag(clock, 150, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(clock, 150, 350)
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
  })
})

describe('App, dragging with the options popover open', () => {
  const dialog = (name: string) => screen.queryByRole('dialog', { name: `${name} options` })

  it('closes the popover when the Widget it belongs to is pressed to be moved', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()

    const clock = box('clock')
    press(clock, 450, 350)
    expect(dialog('Clock')).toBeNull()
    drag(clock, 250, 350)
    release(clock, 250, 350)
    await settled()

    expect(dialog('Clock')).toBeNull()
    expect(await placeInStorage('clock0aa')).toEqual({ col: 3, row: 4 })
  })

  it('closes the popover of another Widget too: a press elsewhere is a press elsewhere', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()

    press(box('weather'), 1150, 50)
    expect(dialog('Clock')).toBeNull()
    release(box('weather'), 1150, 50)
  })

  it('does not start a drag from the Options button, and opens the options as before', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const options = screen.getByRole('button', { name: 'Clock options' })

    press(options, 450, 350)
    drag(options, 250, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(options, 250, 350)
    fireEvent.click(options)
    await settled()

    expect(dialog('Clock')).not.toBeNull()
    expect(set).not.toHaveBeenCalled()
  })

  it('leaves Escape for the popover first, then for edit mode, and a drag before both', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    // The popover first.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(dialog('Clock')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

    // Then a Widget in the air.
    const clock = box('clock')
    press(clock, 450, 350)
    drag(clock, 250, 350)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    release(clock, 250, 350)

    // Then edit mode.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('draws the popover beside the Widget where it is after a drop', async () => {
    await drawn()
    const clock = box('clock')
    press(clock, 450, 350)
    drag(clock, 250, 350)
    release(clock, 250, 350)
    await settled()

    // The Options button is on the Widget that moved, and opens its popover.
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()
    expect(box('clock').style.gridColumn).toBe('3 / span 4')
  })
})

describe('App, dragging and the remove button', () => {
  const remove = () => screen.getByRole('button', { name: 'Remove Clock' })
  const widgets = async () =>
    ((await stored('layout')) as { widgets: { id: string }[] }).widgets.map((w) => w.id)

  it('does not start a drag from the × of a Widget, which still removes it when pressed', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    press(remove(), 450, 350)
    drag(remove(), 250, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(document.querySelector('.widget-box--moving')).toBeNull()
    release(remove(), 250, 350)
    await settled()
    // A press that moved and let go is not a click of anything, and a drag was not started.
    expect(set).not.toHaveBeenCalled()
    expect(await widgets()).toContain('clock0aa')

    fireEvent.click(remove())
    await settled()
    expect(await widgets()).toEqual(['weather1'])
    expect(writtenKeys(set)).toEqual(['layout'])
  })

  it('does not remove the Widget when a drag ends over its ×: the click after a drag is swallowed', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')

    press(clock, 450, 350)
    drag(clock, 250, 350)
    release(clock, 250, 350)
    // What a browser sends right after a release over a button.
    fireEvent.click(remove())
    await settled()

    // The Clock moved (one write) and was not removed.
    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await widgets()).toEqual(['clock0aa', 'weather1'])
    expect(await placeInStorage('clock0aa')).toEqual({ col: 3, row: 4 })

    // The next click is a click again.
    await new Promise((resolve) => setTimeout(resolve, 5))
    fireEvent.click(remove())
    await settled()
    expect(await widgets()).toEqual(['weather1'])
  })
})
