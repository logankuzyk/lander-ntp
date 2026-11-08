import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

// The page, resized by a person's pointer, against the fake browser's storage: what a resize
// writes, and where, and what it does to the options popover. happy-dom measures nothing, so the
// Grid is said to be 1200 by 800 pixels at the window's top left: a cell is 100 by 100.
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
const handle = (type: string) => {
  const found = box(type).querySelector<HTMLElement>('.widget-box__resize')
  if (!found) throw new Error(`no handle on ${type}`)
  return found
}

const MOUSE = { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' }
const press = (el: Element, x: number, y: number) =>
  fireEvent.pointerDown(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const drag = (el: Element, x: number, y: number) =>
  fireEvent.pointerMove(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const release = (el: Element, x: number, y: number) =>
  fireEvent.pointerUp(el, { ...MOUSE, clientX: x, clientY: y })

// Just inside the Clock's bottom right corner (800, 500): where its handle is.
const HANDLE = { x: 790, y: 490 }

/** What is stored in sync, by key. */
const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown

type StoredWidget = { col: number; h: number; id: string; row: number; w: number }
const inStorage = async (id: string) => {
  const layout = (await stored('layout')) as { widgets: StoredWidget[] }
  return layout.widgets.find((candidate) => candidate.id === id)
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
  // A resize swallows the click that follows it until the next task.
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('App, resizing a Widget', () => {
  it('writes sync:layout once for a resize, and nothing else, none while the pointer moves', async () => {
    await drawn()
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    press(handle('clock'), HANDLE.x, HANDLE.y)
    for (let step = 1; step <= 20; step++) drag(handle('clock'), HANDLE.x + step * 10, HANDLE.y)
    await settled()
    expect(set).not.toHaveBeenCalled()

    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    // It really did change size: a write of an unchanged Layout would prove nothing.
    expect(await inStorage('clock0aa')).toMatchObject({ col: 5, h: 3, row: 4, w: 6 })
    expect(await inStorage('weather1')).toMatchObject({ col: 11, h: 2, row: 1, w: 2 })
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(box('clock').style.gridColumn).toBe('5 / span 6')
    expect(box('clock').style.gridRow).toBe('4 / span 3')
    expect(box('clock').style.width).toBe('')
  })

  it('writes the Layout worked out from the settings, with the size changed, on the first resize', async () => {
    // No stored Layout: the Clock's place is worked out, and the first change stores it all.
    await settingsItem.setValue(SETTINGS)
    const view = render(<App />)
    await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage(box('clock').dataset.widgetId!)).toMatchObject({
      col: 5,
      h: 3,
      row: 4,
      w: 6,
    })
    expect(await stored('settings')).toEqual(settingsBefore)
  })

  it('writes nothing for a refused size, an Escape, or a press that did not move', async () => {
    // The refusal is made with a Weather beside the Clock.
    await drawn({
      ...LAYOUT,
      widgets: [
        LAYOUT.widgets[0] && { ...LAYOUT.widgets[0], col: 3 },
        LAYOUT.widgets[1] && { ...LAYOUT.widgets[1], col: 8, row: 4 },
      ],
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const grab = handle('clock')

    // Over the Weather: the Clock is at columns 3 to 6, its corner (600, 500), and the Weather
    // starts at column 8 (x 700).
    press(grab, 590, 490)
    drag(grab, 890, 490)
    release(grab, 890, 490)
    // Escape.
    press(grab, 590, 490)
    drag(grab, 490, 490)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    release(grab, 490, 490)
    // A press.
    press(grab, 590, 490)
    release(grab, 590, 490)
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(box('clock').style.gridColumn).toBe('3 / span 4')
  })

  it('writes nothing for a size at a limit it is already at', async () => {
    await drawn({
      ...LAYOUT,
      widgets: [{ ...LAYOUT.widgets[0], col: 2, h: 4, w: 8 }],
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    // The corner is at (900, 500); pressed 10 in, and pulled far past the largest.
    press(handle('clock'), 890, 490)
    drag(handle('clock'), 1190, 790)
    release(handle('clock'), 1190, 790)
    await settled()
    expect(set).not.toHaveBeenCalled()
  })

  it('makes at most two writes for twenty flicks in a row', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    // The Clock a column wider and back, twenty times, as quickly as events come.
    for (let flick = 0; flick < 20; flick++) {
      const from = flick % 2 === 0 ? HANDLE.x : HANDLE.x + 100
      const to = flick % 2 === 0 ? HANDLE.x + 100 : HANDLE.x
      press(handle('clock'), from, HANDLE.y)
      drag(handle('clock'), to, HANDLE.y)
      release(handle('clock'), to, HANDLE.y)
    }
    await settled()

    expect(set.mock.calls.length).toBeLessThanOrEqual(2)
    expect(writtenKeys(set).every((keys) => keys === 'layout')).toBe(true)
    // And it ended as the last flick left it: back at the size it began.
    expect(await inStorage('clock0aa')).toMatchObject({ h: 2, w: 4 })
  })

  it('does nothing to a Layout a newer version wrote, and writes nothing', async () => {
    await drawn({ ...LAYOUT, v: 2 })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    expect(document.querySelector('.grid--movable')).toBeNull()
    expect(document.querySelector('.widget-box__resize')).toBeNull()
    press(box('clock'), HANDLE.x, HANDLE.y)
    drag(box('clock'), 990, 590)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(box('clock'), 990, 590)
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
  })

  it('does not give a Widget of a type this version does not know a handle, and keeps it as it was', async () => {
    await drawn({
      ...LAYOUT,
      widgets: [
        {
          ...LAYOUT.widgets[0],
          id: 'futr0001',
          options: { colour: 'teal' },
          type: 'future-widget',
        },
        LAYOUT.widgets[1],
      ],
    })
    expect(box('future-widget').querySelector('.widget-box__resize')).toBeNull()
    expect(handle('weather')).not.toBeNull()
  })
})

describe('App, resizing with the options popover open', () => {
  const dialog = (name: string) => screen.queryByRole('dialog', { name: `${name} options` })

  it('closes the popover when the handle of the Widget it belongs to is pressed', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()

    press(handle('clock'), HANDLE.x, HANDLE.y)
    expect(dialog('Clock')).toBeNull()
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    await settled()

    // It does not come back by itself, and the options button still opens it beside the new size.
    expect(dialog('Clock')).toBeNull()
    expect(await inStorage('clock0aa')).toMatchObject({ h: 3, w: 6 })
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()
    expect(box('clock').style.gridColumn).toBe('5 / span 6')
  })

  it('closes the popover of another Widget too: a press elsewhere is a press elsewhere', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()

    press(handle('weather'), 1190, 190)
    expect(dialog('Clock')).toBeNull()
    release(handle('weather'), 1190, 190)
  })

  it('leaves Escape for the popover first, then a resize in the air, then edit mode', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(dialog('Clock')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    release(handle('clock'), 990, 590)

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})

describe('App, the handle and the buttons on the frame', () => {
  it('does not resize from the Options button or the ×, and they still do what they did', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const options = screen.getByRole('button', { name: 'Clock options' })
    const remove = screen.getByRole('button', { name: 'Remove Clock' })

    for (const button of [options, remove]) {
      press(button, HANDLE.x, HANDLE.y)
      drag(button, 990, 590)
      expect(document.querySelector('.grid__ghost')).toBeNull()
      expect(document.querySelector('.widget-box--resizing')).toBeNull()
      release(button, 990, 590)
    }
    await settled()
    expect(set).not.toHaveBeenCalled()
  })

  it('does not remove the Widget when a resize ends over its ×: the click after it is swallowed', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Clock' }))
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage('clock0aa')).toMatchObject({ h: 3, w: 6 })
    expect(screen.queryByText(/Clock removed/)).toBeNull()
  })

  it('is on the Weather’s small box and apart from its buttons, in the markup', async () => {
    await drawn()
    const parts = ['.widget-box__options', '.widget-box__remove', '.widget-box__resize']
    for (const part of parts) {
      expect(box('weather').querySelectorAll(part)).toHaveLength(1)
    }
  })
})
