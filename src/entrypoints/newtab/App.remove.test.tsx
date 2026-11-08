import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makePlace, makeWeather } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

const PLACE = makePlace()

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, v: 1 }

const clock = (id: string, col: number, options: Record<string, unknown> = {}) => ({
  col,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false, ...options },
  row: 4,
  type: 'clock',
  w: 4,
})

const weather = {
  col: 11,
  h: 2,
  id: 'weather1',
  options: { place: PLACE, unit: 'celsius' },
  row: 1,
  type: 'weather',
  w: 2,
}

/** In reading order: the Weather in the corner, the Clock on the left, the Clock in the middle. */
const THREE = {
  v: 1,
  widgets: [clock('clock0aa', 5, { showSeconds: true }), clock('clock0bb', 1), weather],
}

type StoredLayout = { v: number; waiting?: unknown; widgets: { id: string; options: unknown }[] }

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
const boxOf = (id: string) => {
  const box = document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)
  if (!box) throw new Error(`no Widget ${id}`)
  return box
}
/** The id the page's one Widget of this type is stored under (a new install's is worked out). */
const idOfType = (type: string) =>
  document.querySelector<HTMLElement>(`[data-widget="${type}"]`)?.dataset.widgetId ?? ''
const removeButton = (id: string) => within(boxOf(id)).getByRole('button', { name: /^Remove / })
const remove = (id: string) => fireEvent.click(removeButton(id))
const present = (id: string) => document.querySelector(`[data-widget-id="${id}"]`) !== null
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

/** What is stored in sync, by key. */
const stored = async (key: string) => (await fakeBrowser.storage.sync.get(key))[key] as unknown
const storedLayout = async () => (await stored('layout')) as StoredLayout
const storedWidget = async (id: string) =>
  (await storedLayout()).widgets.find((widget) => widget.id === id)

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
  vi.useRealTimers()
  document.documentElement.removeAttribute('style')
})

describe('App, removing a Widget', () => {
  describe('the × button', () => {
    it('is on every Widget in edit mode, named for what it removes, and nowhere outside it', async () => {
      await drawn(THREE)
      expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()

      edit()

      expect(screen.getAllByRole('button', { name: 'Remove Clock' })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: 'Remove Weather' })).toHaveLength(1)
    })

    it('is not there when a newer version wrote the Layout, which nothing here may change', async () => {
      await drawn({ v: 2, widgets: THREE.widgets })
      edit()

      expect(present('clock0aa')).toBe(true)
      expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
    })

    it('removes its Widget with one write, to sync:layout alone', async () => {
      await drawn(THREE)
      const settingsBefore = await stored('settings')
      edit()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      remove('clock0bb')
      await settled()

      expect(present('clock0bb')).toBe(false)
      expect(present('clock0aa')).toBe(true)
      expect(writtenKeys(set)).toEqual(['layout'])
      expect((await storedLayout()).widgets.map(({ id }) => id)).toEqual(['clock0aa', 'weather1'])
      expect(await stored('settings')).toEqual(settingsBefore)
    })

    it('removes the Clock a new install has without ever writing clock.enabled', async () => {
      await drawn()
      const settingsBefore = JSON.stringify(await stored('settings'))
      edit()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      remove(idOfType('clock'))
      await settled()

      expect(document.querySelector('[data-widget="clock"]')).toBeNull()
      expect(writtenKeys(set)).toEqual(['layout'])
      expect((await storedLayout()).widgets).toEqual([])
      // Byte for byte: no `clock.enabled`, and no `v` or anything else added.
      expect(JSON.stringify(await stored('settings'))).toBe(settingsBefore)
      expect(((await stored('settings')) as Settings).clock.enabled).toBe(true)
    })
  })

  describe('the Delete key', () => {
    const frameOf = (id: string) => boxOf(id)

    it('removes the Widget whose frame has focus, with one write to sync:layout', async () => {
      await drawn(THREE)
      edit()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
      frameOf('clock0aa').focus()

      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete' })
      await settled()

      expect(present('clock0aa')).toBe(false)
      expect(present('clock0bb')).toBe(true)
      expect(writtenKeys(set)).toEqual(['layout'])
    })

    it('takes Backspace too, which is what the Delete key is called on a Mac', async () => {
      await drawn(THREE)
      edit()

      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Backspace' })

      expect(present('clock0aa')).toBe(false)
    })

    it('removes the Widget when it is pressed on that Widget’s own buttons', async () => {
      await drawn(THREE)
      edit()

      fireEvent.keyDown(
        within(frameOf('clock0aa')).getByRole('button', { name: 'Clock options' }),
        {
          key: 'Delete',
        },
      )

      expect(present('clock0aa')).toBe(false)
    })

    it('does nothing outside edit mode', async () => {
      await drawn(THREE)
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete' })
      await settled()

      expect(present('clock0aa')).toBe(true)
      expect(set).not.toHaveBeenCalled()
    })

    it('does nothing for a key held down, or with a modifier', async () => {
      await drawn(THREE)
      edit()

      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete', repeat: true })
      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete', metaKey: true })
      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete', shiftKey: true })
      fireEvent.keyDown(frameOf('clock0aa'), { altKey: true, key: 'Delete' })
      fireEvent.keyDown(frameOf('clock0aa'), { ctrlKey: true, key: 'Delete' })

      expect(present('clock0aa')).toBe(true)
    })

    it('does nothing for a key pressed in something inside the Widget, such as a field', async () => {
      await drawn(THREE)
      edit()
      const inside = document.createElement('input')
      frameOf('clock0aa').append(inside)

      fireEvent.keyDown(inside, { key: 'Backspace' })

      expect(present('clock0aa')).toBe(true)
    })

    it('does nothing while a newer version’s Layout is shown', async () => {
      await drawn({ v: 2, widgets: THREE.widgets })
      edit()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      fireEvent.keyDown(frameOf('clock0aa'), { key: 'Delete' })
      await settled()

      expect(present('clock0aa')).toBe(true)
      expect(set).not.toHaveBeenCalled()
    })
  })

  describe('the notice', () => {
    it('says what was removed and offers Undo, in the page’s one live region', async () => {
      await drawn(THREE)
      edit()

      remove('clock0bb')

      const live = screen.getAllByRole('status')
      expect(live).toHaveLength(1)
      expect(live[0]?.textContent).toContain('Clock removed.')
      expect(within(live[0] as HTMLElement).getByRole('button', { name: 'Undo' })).toBeTruthy()
    })

    it('tells two Widgets of a kind apart by their names', async () => {
      await drawn(THREE)
      edit()

      remove('weather1')

      expect(screen.getByRole('status').textContent).toContain('Weather, Victoria removed.')
    })

    it('can be dismissed, and then there is no Undo', async () => {
      await drawn(THREE)
      edit()
      remove('clock0bb')

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
      expect(present('clock0bb')).toBe(false)
    })

    it('goes after 8 seconds, and the Widget with its options is gone for good', async () => {
      await drawn(THREE)
      edit()
      vi.useFakeTimers({ toFake: ['clearTimeout', 'Date', 'setTimeout'] })
      remove('clock0aa')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7_999)
      })
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeNull()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })

      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
      expect(present('clock0aa')).toBe(false)
      // Nothing keeps it: not in the Layout, and not as options waiting for a Widget to be added.
      const layout = await storedLayout()
      expect(layout.waiting).toBeUndefined()
      expect(JSON.stringify(layout)).not.toContain('clock0aa')
    })

    it('waits while the pointer is over it', async () => {
      await drawn(THREE)
      edit()
      vi.useFakeTimers({ toFake: ['clearTimeout', 'Date', 'setTimeout'] })
      remove('clock0aa')
      fireEvent.mouseEnter(
        screen.getByRole('button', { name: 'Undo' }).closest('.callout') as Element,
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })

      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeNull()
    })

    it('is for the last removal only: the next one takes its place', async () => {
      await drawn(THREE)
      edit()
      remove('clock0bb')
      remove('weather1')

      expect(screen.getByRole('status').textContent).toContain('Weather, Victoria removed.')
      undo()
      await settled()

      expect(present('weather1')).toBe(true)
      expect(present('clock0bb')).toBe(false)
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    })
  })

  describe('Undo', () => {
    it('puts the Widget back where it was, with its id and its options, in one write', async () => {
      await drawn(THREE)
      edit()
      const original = await storedWidget('clock0aa')
      remove('clock0aa')
      await settled()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      undo()
      await settled()

      expect(present('clock0aa')).toBe(true)
      expect(writtenKeys(set)).toEqual(['layout'])
      // Exactly as it was stored, options included (the seconds are on).
      expect(await storedWidget('clock0aa')).toEqual(original)
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    })

    it('brings back a Weather’s options, with its reading drawn again', async () => {
      await drawn(THREE)
      edit()
      remove('weather1')
      await settled()

      undo()
      await settled()

      expect(await storedWidget('weather1')).toMatchObject({ options: { place: PLACE } })
      expect(boxOf('weather1').getAttribute('aria-label')).toBe('Weather, Victoria')
    })

    it('writes nothing to the settings, however it goes', async () => {
      await drawn(THREE)
      const settingsBefore = await stored('settings')
      edit()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      remove('clock0aa')
      await settled()
      undo()
      await settled()

      expect(writtenKeys(set)).toEqual(['layout', 'layout'])
      expect(await stored('settings')).toEqual(settingsBefore)
    })

    it('puts it in the nearest free place when another device took its own meanwhile', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      // Another device put a Clock where the removed one was.
      await act(async () => {
        await fakeBrowser.storage.sync.set({
          layout: { v: 1, widgets: [clock('other000', 5), clock('clock0bb', 1), weather] },
        })
      })
      await waitFor(() => expect(present('other000')).toBe(true))

      undo()
      await settled()

      expect(present('clock0aa')).toBe(true)
      const restored = (await storedWidget('clock0aa')) as unknown as { col: number; row: number }
      expect([restored.col, restored.row]).toEqual([5, 2])
      expect(await storedWidget('other000')).toMatchObject({ col: 5, row: 4 })
    })

    it('says so, and writes nothing, when there is no room left to put it back', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      await act(async () => {
        await fakeBrowser.storage.sync.set({
          layout: {
            v: 1,
            widgets: [{ ...clock('everything', 1), col: 1, h: 8, row: 1, w: 12 }],
          },
        })
      })
      await waitFor(() => expect(present('everything')).toBe(true))
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      undo()
      await settled()

      expect(screen.getByRole('status').textContent).toContain('No room to put Clock back.')
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
      expect(set).not.toHaveBeenCalled()
    })

    it('puts the Widget back even when the Layout is at the Widget limit again (LR-12)', async () => {
      // Eight Weathers along the top and bottom edges, the middle free.
      const weatherAt = (n: number, col: number, row: number) => ({
        col,
        h: 2,
        id: `weather${n}`,
        options: { place: PLACE, unit: 'celsius' },
        row,
        type: 'weather',
        w: 2,
      })
      await drawn({
        v: 1,
        widgets: [
          weatherAt(1, 1, 1),
          weatherAt(2, 3, 1),
          weatherAt(3, 9, 1),
          weatherAt(4, 11, 1),
          weatherAt(5, 1, 7),
          weatherAt(6, 3, 7),
          weatherAt(7, 9, 7),
          weatherAt(8, 11, 7),
        ],
      })
      edit()
      remove('weather5')
      await settled()
      // Seven: a Clock is added, and the Layout is at the limit again, with the notice still up.
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Clock' }))
      await settled()
      expect((await storedLayout()).widgets).toHaveLength(8)
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      undo()
      await settled()

      expect(present('weather5')).toBe(true)
      expect(writtenKeys(set)).toEqual(['layout'])
      expect((await storedLayout()).widgets).toHaveLength(9)
      // Nine: adding stays off.
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      expect(document.querySelector('.add-menu__note')?.textContent).toBe(
        "That's all 8 widgets. Remove one to add another.",
      )
    })

    it('is nothing to do when the Widget is back already, such as put back from another tab', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      await act(async () => {
        await fakeBrowser.storage.sync.set({ layout: THREE })
      })
      await waitFor(() => expect(present('clock0aa')).toBe(true))
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      // The notice has gone with it: there is nothing to undo.
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
      await settled()
      expect(set).not.toHaveBeenCalled()
    })

    it('writes nothing for a Widget that came back by itself while Undo was pressed', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      // The Widget comes back (another tab) and Undo is pressed before the page has heard.
      const button = screen.getByRole('button', { name: 'Undo' })
      await act(async () => {
        await fakeBrowser.storage.sync.set({ layout: THREE })
      })
      await waitFor(() => expect(present('clock0aa')).toBe(true))
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      fireEvent.click(button)
      await settled()

      expect(set).not.toHaveBeenCalled()
      expect(document.querySelectorAll('[data-widget-id="clock0aa"]')).toHaveLength(1)
    })

    it('stays possible after leaving edit mode, until the notice goes', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      undo()
      await settled()

      expect(present('clock0aa')).toBe(true)
    })
  })

  describe('when the browser refuses the save', () => {
    it('puts the Widget back, says so, and leaves no Undo for a Widget that is there', async () => {
      await drawn(THREE)
      edit()
      vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('QUOTA_BYTES'))

      remove('clock0aa')
      await settled()

      expect(present('clock0aa')).toBe(true)
      const live = screen.getByRole('status')
      expect(live.textContent).toContain("Couldn't save that. Try again in a minute.")
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByText(/removed\./)).toBeNull()
    })

    it('keeps Undo available when it is the Undo’s own save that is refused', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
      set.mockRejectedValueOnce(new Error('QUOTA_BYTES'))

      undo()
      await settled()

      // The Widget is still gone, the page says why, and the Undo line waits behind it.
      expect(present('clock0aa')).toBe(false)
      expect(screen.getByRole('status').textContent).toContain("Couldn't save that.")
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.getByRole('status').textContent).toContain('Clock removed.')

      undo()
      await settled()

      expect(present('clock0aa')).toBe(true)
      expect((await storedLayout()).widgets.map(({ id }) => id)).toContain('clock0aa')
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    })

    it('shows the refused save over the Undo line, whichever item it was that was refused', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('QUOTA_BYTES'))

      // Something else is saved meanwhile, and refused: Dim, in the settings.
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(await screen.findByRole('switch', { name: /dim/i }))
      await settled()

      const live = screen.getByRole('status')
      expect(live.textContent).toContain("Couldn't save that.")
      expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    })
  })

  describe('after the Layout turned read-only', () => {
    it('does not put a Widget back once a newer version has written the Layout', async () => {
      await drawn(THREE)
      edit()
      remove('clock0aa')
      await settled()
      await act(async () => {
        await fakeBrowser.storage.sync.set({ layout: { v: 2, widgets: [clock('newer000', 5)] } })
      })
      await waitFor(() => expect(present('newer000')).toBe(true))
      const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

      // The notice may still be up; pressing it changes nothing.
      const button = screen.queryByRole('button', { name: 'Undo' })
      if (button) fireEvent.click(button)
      await settled()

      expect(present('clock0aa')).toBe(false)
      expect(set).not.toHaveBeenCalled()
    })
  })

  describe('focus', () => {
    it('moves to the next Widget in reading order when one is removed with ×', async () => {
      await drawn(THREE)
      edit()

      remove('weather1')
      await settled()

      expect(document.activeElement).toBe(boxOf('clock0bb'))
    })

    it('moves to the next Widget when one is removed with Delete', async () => {
      await drawn(THREE)
      edit()
      boxOf('clock0bb').focus()

      fireEvent.keyDown(boxOf('clock0bb'), { key: 'Delete' })
      await settled()

      expect(document.activeElement).toBe(boxOf('clock0aa'))
    })

    it('moves to the Edit controls when there is no Widget after it', async () => {
      await drawn(THREE)
      edit()

      remove('clock0aa')
      await settled()

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
    })

    it('moves to the Edit controls when the only Widget is removed', async () => {
      await drawn()
      edit()

      remove(idOfType('clock'))
      await settled()

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
    })

    it('moves to the next Widget when the notice is dismissed from the keyboard, not to the body', async () => {
      await drawn(THREE)
      edit()
      remove('clock0bb')
      await settled()
      const dismiss = screen.getByRole('button', { name: 'Dismiss' })
      dismiss.focus()

      fireEvent.keyDown(dismiss, { key: 'Enter' })
      fireEvent.click(dismiss)
      await settled()

      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
      expect(document.activeElement).not.toBe(document.body)
      expect(document.activeElement).toBe(boxOf('clock0aa'))
    })

    it('moves to the Edit controls when the notice goes by itself while its button has focus', async () => {
      await drawn(THREE)
      edit()
      vi.useFakeTimers({ toFake: ['clearTimeout', 'Date', 'setTimeout'] })
      remove('clock0aa')
      screen.getByRole('button', { name: 'Undo' }).focus()
      // Focus is in the notice: its time is paused. Pressing Dismiss is how it goes then.
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }))
    })

    it('lands on the Widget that was put back when Undo is pressed', async () => {
      await drawn(THREE)
      edit()
      remove('clock0bb')
      await settled()
      screen.getByRole('button', { name: 'Undo' }).focus()

      undo()
      await settled()

      expect(document.activeElement).toBe(boxOf('clock0bb'))
    })
  })

  describe('the options popover', () => {
    it('closes when its own Widget is removed with ×', async () => {
      await drawn(THREE)
      edit()
      fireEvent.click(within(boxOf('weather1')).getByRole('button', { name: 'Weather options' }))
      expect(screen.queryByRole('dialog', { name: /options$/ })).not.toBeNull()

      remove('weather1')
      await settled()

      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('closes when another Widget’s × is pressed, and that Widget goes', async () => {
      await drawn(THREE)
      edit()
      fireEvent.click(within(boxOf('weather1')).getByRole('button', { name: 'Weather options' }))

      fireEvent.pointerDown(removeButton('clock0aa'))
      remove('clock0aa')
      await settled()

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(present('clock0aa')).toBe(false)
      expect(present('weather1')).toBe(true)
    })

    it('does not come back with the Widget on Undo', async () => {
      await drawn(THREE)
      edit()
      fireEvent.click(within(boxOf('weather1')).getByRole('button', { name: 'Weather options' }))
      remove('weather1')
      await settled()

      undo()
      await settled()

      expect(present('weather1')).toBe(true)
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
