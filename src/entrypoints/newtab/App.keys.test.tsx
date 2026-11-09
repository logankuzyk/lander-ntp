import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

// The page, moved and resized from the keyboard, against the fake browser's storage: what a
// put-down writes, and where, what the first key does to the rest of the page, and what it does to
// the options popover. happy-dom measures nothing, so the Grid is said to be 1200 by 800 pixels.
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

const key = (el: Element, name: string, extra: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key: name, ...extra })

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

const said = () => document.querySelector('.grid + [aria-live="polite"]')?.textContent ?? ''

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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('App, moving and resizing from the keyboard', () => {
  it('writes sync:layout once for a pick-up, moves and a put-down, and nothing else', async () => {
    await drawn()
    const settingsBefore = await stored('settings')
    const onboardingBefore = await stored('onboarding')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()

    key(clock, 'Enter')
    for (let i = 0; i < 10; i++) key(clock, i % 2 === 0 ? 'ArrowDown' : 'ArrowUp')
    key(clock, 'ArrowLeft')
    key(clock, 'ArrowLeft')
    key(clock, 'ArrowRight', { shiftKey: true })
    key(clock, 'ArrowDown', { shiftKey: true })
    await settled()
    expect(set).not.toHaveBeenCalled()

    key(clock, 'Enter')
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    // It really did move and change size: a write of an unchanged Layout would prove nothing.
    expect(await inStorage('clock0aa')).toMatchObject({ col: 3, h: 3, row: 4, w: 5 })
    expect(await inStorage('weather1')).toMatchObject({ col: 11, h: 2, row: 1, w: 2 })
    expect(await stored('settings')).toEqual(settingsBefore)
    expect(await stored('onboarding')).toEqual(onboardingBefore)
    expect(box('clock').style.gridColumn).toBe('3 / span 5')
    expect(document.activeElement).toBe(box('clock'))
  })

  it('writes the Layout worked out from the settings on the first put-down', async () => {
    await settingsItem.setValue(SETTINGS)
    const view = render(<App />)
    await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const settingsBefore = await stored('settings')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()

    key(clock, ' ')
    key(clock, 'ArrowRight')
    key(clock, ' ')
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage(box('clock').dataset.widgetId!)).toMatchObject({
      col: 6,
      h: 2,
      row: 4,
      w: 4,
    })
    expect(await stored('settings')).toEqual(settingsBefore)
  })

  it('writes nothing for Escape, a refused place, a put-down where it began, or Tab away', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()

    // Escape.
    key(clock, 'Enter')
    key(clock, 'ArrowDown')
    key(clock, 'Escape')
    // Over the Weather: Enter is refused and it stays up, then it is put back.
    key(clock, 'Enter')
    for (let i = 0; i < 3; i++) key(clock, 'ArrowUp')
    for (let i = 0; i < 3; i++) key(clock, 'ArrowRight')
    key(clock, 'Enter')
    key(clock, 'Escape')
    // Back where it began.
    key(clock, 'Enter')
    key(clock, 'ArrowDown')
    key(clock, 'ArrowUp')
    key(clock, 'Enter')
    // Away from the Widget.
    key(clock, 'Enter')
    key(clock, 'ArrowDown')
    act(() => screen.getByRole('button', { name: 'Done' }).focus())
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    expect(box('clock').style.gridRow).toBe('4 / span 2')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('keeps → from the page’s next-photo shortcut while a Widget is up, and not before or after', async () => {
    await drawn()
    // The shortcut listens on the window: a key that reaches it is a key the shortcut answers.
    const heard: string[] = []
    const listener = (event: KeyboardEvent) => heard.push(event.key)
    window.addEventListener('keydown', listener)
    const clock = box('clock')
    clock.focus()

    key(clock, 'ArrowRight')
    expect(heard).toEqual(['ArrowRight'])

    key(clock, 'Enter')
    key(clock, 'ArrowRight')
    key(clock, 'ArrowRight')
    expect(heard).toEqual(['ArrowRight'])

    key(clock, 'Enter')
    key(clock, 'ArrowRight')
    expect(heard).toEqual(['ArrowRight', 'ArrowRight'])
    window.removeEventListener('keydown', listener)
  })

  it('leaves Escape for the Widget in the air first, then edit mode', async () => {
    await drawn()
    const clock = box('clock')
    clock.focus()
    key(clock, 'Enter')
    key(clock, 'Escape')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    key(clock, 'Escape')
    expect(clock.dataset.selected).toBe('false')
    key(clock, 'Escape')
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('says what is happening in the page’s live region as it goes', async () => {
    await drawn()
    const clock = box('clock')
    clock.focus()
    key(clock, 'Enter')
    expect(said()).toMatch(/^Clock picked up at column 5, row 4\. Arrow keys move it,/)
    key(clock, 'ArrowRight')
    expect(said()).toBe('Column 6, row 4.')
    key(clock, 'Enter')
    expect(said()).toBe('Clock put down at column 6, row 4.')
  })

  it('does nothing to a Layout a newer version wrote, and writes nothing', async () => {
    await drawn({ ...LAYOUT, v: 2 })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()

    key(clock, 'Enter')
    key(clock, 'ArrowRight')
    key(clock, 'Enter')
    await settled()

    expect(set).not.toHaveBeenCalled()
    expect(clock.classList.contains('widget-box--held')).toBe(false)
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
  })
})

describe('App, picking up with the options popover open', () => {
  // A Weather is named with its place (`Weather, Victoria options`), so by the start of the name.
  const dialog = (name: string) =>
    screen.queryByRole('dialog', { name: new RegExp(`^${name}\\b.* options$`) })

  it('closes the popover on the pick-up, and focus stays on the Widget', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    expect(dialog('Clock')).not.toBeNull()
    const clock = box('clock')
    clock.focus()

    key(clock, 'Enter')

    expect(dialog('Clock')).toBeNull()
    await settled()
    expect(document.activeElement).toBe(box('clock'))
    expect(box('clock').classList.contains('widget-box--held')).toBe(true)
  })

  it('closes the popover of another Widget too', async () => {
    await drawn()
    fireEvent.click(screen.getByRole('button', { name: 'Weather options' }))
    expect(dialog('Weather')).not.toBeNull()
    const clock = box('clock')
    clock.focus()

    key(clock, 'Enter')

    expect(dialog('Weather')).toBeNull()
    await settled()
    expect(document.activeElement).toBe(box('clock'))
  })
})

describe('App, a drag with the mouse while a Widget is picked up from the keyboard', () => {
  const MOUSE = { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' }
  const press = (el: Element, x: number, y: number) =>
    fireEvent.pointerDown(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
  const drag = (el: Element, x: number, y: number) =>
    fireEvent.pointerMove(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
  const release = (el: Element, x: number, y: number) =>
    fireEvent.pointerUp(el, { ...MOUSE, clientX: x, clientY: y })

  it('writes the drag once and not the keyboard’s place, and the next Enter writes nothing', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()
    key(clock, 'Enter')
    key(clock, 'ArrowDown')
    key(clock, 'ArrowDown')

    // The Clock is stored at columns 5 to 8, rows 4 and 5: x 400 to 800, y 300 to 500.
    press(clock, 600, 400)
    drag(clock, 590, 380)
    drag(clock, 500, 300)
    release(clock, 500, 300)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage('clock0aa')).toMatchObject({ col: 4, h: 2, row: 3, w: 4 })
    expect(box('clock').classList.contains('widget-box--held')).toBe(false)
    expect(box('clock').style.gridColumn).toBe('4 / span 4')
    expect(box('clock').style.gridRow).toBe('3 / span 2')

    // A fresh pick-up, which is put down where it is: nothing to write.
    key(box('clock'), 'Enter')
    key(box('clock'), 'Enter')
    await settled()
    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage('clock0aa')).toMatchObject({ col: 4, row: 3 })
  })

  it('writes the handle’s resize once, and the keyboard session is gone', async () => {
    await drawn()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const clock = box('clock')
    clock.focus()
    key(clock, 'Enter')
    key(clock, 'ArrowRight', { shiftKey: true })
    const handle = clock.querySelector<HTMLElement>('.widget-box__resize')!

    press(handle, 790, 490)
    drag(handle, 890, 590)
    release(handle, 890, 590)
    await settled()

    expect(writtenKeys(set)).toEqual(['layout'])
    expect(await inStorage('clock0aa')).toMatchObject({ col: 5, h: 3, row: 4, w: 5 })
    expect(box('clock').classList.contains('widget-box--held')).toBe(false)
    key(box('clock'), 'Enter')
    key(box('clock'), 'Enter')
    await settled()
    expect(writtenKeys(set)).toEqual(['layout'])
  })
})

describe('App, the Widget’s own keys while it is picked up', () => {
  it.each(['Delete', 'Backspace'])(
    'does not remove a Widget in the air with %s, and writes nothing',
    async (name) => {
      await drawn()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
      const clock = box('clock')
      clock.focus()
      key(clock, 'Enter')

      key(clock, name)
      await settled()

      expect(box('clock').classList.contains('widget-box--held')).toBe(true)
      expect(screen.queryByText(/Clock removed/)).toBeNull()
      expect(set).not.toHaveBeenCalled()
      // And it removes the Widget when it is not in the air, so the test is not vacuous.
      key(clock, 'Escape')
      key(clock, name)
      await settled()
      expect(screen.queryByText(/Clock removed/)).not.toBeNull()
    },
  )

  it('does not open the options with O while it is up', async () => {
    await drawn()
    const clock = box('clock')
    clock.focus()
    key(clock, 'Enter')
    key(clock, 'o')
    expect(screen.queryByRole('dialog')).toBeNull()
    key(clock, 'Escape')
    key(clock, 'o')
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })
})

describe('App, the keys on a Widget’s own buttons', () => {
  it('leaves Enter on the Options button to the button, which opens the popover', async () => {
    await drawn()
    const options = screen.getByRole('button', { name: 'Clock options' })
    options.focus()
    key(options, 'Enter')
    expect(box('clock').classList.contains('widget-box--held')).toBe(false)
  })
})
