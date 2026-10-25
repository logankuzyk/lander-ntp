import { act, render, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { checkLayout, layoutWidget, storedLayout as storedFrom } from './check'
import { deriveLayout } from './derive'
import {
  EXAMPLE_LAYOUT_JSON,
  exampleLayout,
  knownAt,
  storedAt,
  syncBytes,
  widgetAt,
} from './fixtures'
import type { Layout, PlacedWidget, StoredLayout } from './types'
import { useLayout } from './useLayout'

afterEach(() => vi.restoreAllMocks())

/** Today's settings for a new install, with the unit fixed so the tests do not depend on the locale. */
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  weather: { ...DEFAULT_SETTINGS.weather, unit: 'celsius' },
}

/** Draws nothing; the test holds on to what the hook gives, and reads it with `current()`. */
function mount(options?: { onRejected?: () => void }, settings: Settings = SETTINGS) {
  const api = {} as ReturnType<typeof useLayout>
  function Probe({ settings }: { settings: Settings }) {
    Object.assign(api, useLayout(settings, options))
    return null
  }
  const { rerender } = render(<Probe settings={settings} />)
  return {
    commit: (next: Layout) => act(() => api.commit(next)),
    current: () => api,
    /** The page is given other settings, as when they change in another tab. */
    withSettings: (next: Settings) => rerender(<Probe settings={next} />),
  }
}

/** What the sync area holds under `layout`, as the browser keeps it. */
const stored = async () =>
  (await fakeBrowser.storage.sync.get('layout')).layout as StoredLayout | undefined

/** What is stored: it must be there. */
const storedLayout = async (): Promise<StoredLayout> => {
  const layout = await stored()
  if (!layout) throw new Error('nothing is stored')
  return layout
}

/**
 * Settings and onboarding as another part of the page left them. A Layout change is a change to
 * `sync:layout` alone: removing a Clock, say, never touches `clock.enabled`.
 */
const OTHERS = {
  onboarding: { dismissed: ['weather'], welcomed: false },
  settings: {
    ...DEFAULT_SETTINGS,
    clock: { ...DEFAULT_SETTINGS.clock, enabled: true },
    font: 'geist',
  },
}

const seedOthers = () => fakeBrowser.storage.sync.set(OTHERS)

const others = () => fakeBrowser.storage.sync.get(['settings', 'onboarding'])

/** The Layout as the page holds it once it has been read. */
const loaded = async (page: ReturnType<typeof mount>): Promise<Layout> => {
  await waitFor(() => expect(page.current().loaded).toBe(true))
  return page.current().layout
}

const placedAt = (layout: Layout, index: number) => knownAt(layout, index).placed

/** The Layout with the Widget at `index` replaced, as a change of its options would make it. */
const withPlaced = (layout: Layout, index: number, placed: PlacedWidget): Layout => ({
  ...layout,
  widgets: layout.widgets.map((widget, i) => (i === index ? layoutWidget(placed) : widget)),
})

describe('useLayout', () => {
  it('has nothing stored when none is, and says it has looked', async () => {
    const page = mount()

    await waitFor(() => expect(page.current().loaded).toBe(true))

    expect(page.current().readOnly).toBe(false)
    expect(await stored()).toBeUndefined()
  })

  it('reads the stored Layout and writes nothing', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const page = mount()

    const layout = await loaded(page)

    expect(layout.widgets.map((widget) => widget.kind)).toEqual(['known', 'known'])
    expect(page.current().readOnly).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })

  it('stores a Layout it has read and not changed byte for byte, for the example in LR-15', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    await seedOthers()
    const page = mount()
    const layout = await loaded(page)

    await page.commit(layout)

    await waitFor(async () => expect(JSON.stringify(await stored())).toBe(EXAMPLE_LAYOUT_JSON))
    expect(syncBytes('layout', await stored())).toBe(480)
    expect(await others()).toEqual(OTHERS)
  })

  it('stores the first Layout when none was stored, and writes nothing to the settings or onboarding', async () => {
    await seedOthers()
    const page = mount()
    await waitFor(() => expect(page.current().loaded).toBe(true))

    await page.commit(checkLayout(exampleLayout()))

    await waitFor(async () => expect(JSON.stringify(await stored())).toBe(EXAMPLE_LAYOUT_JSON))
    expect(await others()).toEqual(OTHERS)
  })

  it('keeps a top-level key, an option key and a Widget type it does not know through a commit', async () => {
    const raw = {
      ...exampleLayout(),
      snapTo: 'grid',
      widgets: [
        ...exampleLayout().widgets,
        {
          col: 1,
          h: 2,
          id: 'zz9y8x7w',
          options: { limit: 5 },
          row: 7,
          type: 'bookmarks',
          w: 3,
        },
      ],
    }
    storedAt(raw, 0).options.hands = 'analog'
    await fakeBrowser.storage.sync.set({ layout: raw })
    const page = mount()

    await page.commit(await loaded(page))

    await waitFor(async () => expect(await stored()).toEqual(raw))
  })

  it('stores a Layout with no Widgets as such: deleting everything is a Layout, not no Layout', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    await seedOthers()
    const page = mount()
    const layout = await loaded(page)

    await page.commit({ ...layout, widgets: [] })

    await waitFor(async () => expect(await stored()).toEqual({ v: 1, widgets: [] }))
    // Emptying the Layout takes the Clock off the page without touching `clock.enabled`.
    expect(await others()).toEqual(OTHERS)
  })

  it('draws options that fail their check as defaults, and changes the stored ones only when that Widget’s options are committed', async () => {
    const raw = exampleLayout()
    const weather = storedAt(raw, 1)
    weather.options = { ...weather.options, unit: 'kelvin' }
    await fakeBrowser.storage.sync.set({ layout: raw })
    const page = mount()
    const layout = await loaded(page)

    // Drawn as the Widget's defaults.
    expect(knownAt(layout, 1).options).toEqual(defaultOptions(weatherDefinition))

    // A commit of something else leaves the stored options as they are.
    await page.commit({ ...layout, widgets: [...layout.widgets] })
    await waitFor(async () => expect(JSON.stringify(await stored())).toBe(JSON.stringify(raw)))
    expect(storedAt(await storedLayout(), 1).options.unit).toBe('kelvin')

    // Committing this Widget's options writes them.
    await page.commit(
      withPlaced(layout, 1, {
        ...placedAt(layout, 1),
        options: { ...placedAt(layout, 1).options, unit: 'fahrenheit' },
      }),
    )
    await waitFor(async () =>
      expect(storedAt(await storedLayout(), 1).options.unit).toBe('fahrenheit'),
    )
  })

  it('loads nine Widgets', async () => {
    const widgets = Array.from({ length: 9 }, (_, i) => ({
      ...exampleLayout().widgets[0],
      id: `clock00${i}`,
      row: i + 1,
    }))
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets } })
    const page = mount()

    const layout = await loaded(page)

    expect(layout.widgets).toHaveLength(9)
    expect(layout.widgets.every((widget) => widget.kind === 'known')).toBe(true)
  })

  it('follows a Layout that arrives from another tab or device, and one that is removed', async () => {
    const page = mount()
    await waitFor(() => expect(page.current().loaded).toBe(true))

    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    await waitFor(() => expect(page.current().layout.widgets).toHaveLength(2))

    // With none stored, the page works one out from the settings again.
    await fakeBrowser.storage.sync.remove('layout')
    await waitFor(() => expect(page.current().layout.widgets).toHaveLength(1))
    expect(knownAt(page.current().layout, 0).placed.type).toBe('clock')
  })

  it('saves one change at a time: twenty commits are two writes, the last carrying the final Layout', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const page = mount()
    const layout = await loaded(page)
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    await act(async () => {
      for (let i = 0; i < 20; i++) {
        page.current().commit(withPlaced(layout, 0, { ...placedAt(layout, 0), col: (i % 8) + 1 }))
      }
    })

    await waitFor(async () => expect(storedAt(await storedLayout(), 0).col).toBe(4))
    expect(set).toHaveBeenCalledTimes(2)
  })
})

describe('useLayout, with nothing stored: the Layout worked out from the settings', () => {
  const VICTORIA = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }
  const updated: Settings = {
    ...SETTINGS,
    weather: { ...SETTINGS.weather, enabled: true, place: VICTORIA },
  }
  /** The keys of every call to `storage.sync.set` so far. */
  const writtenKeys = (set: { mock: { calls: unknown[][] } }) =>
    set.mock.calls.flatMap(([items]) => Object.keys(items as object))

  it('gives the Layout worked out from the settings, before and after the stored one has been looked for', async () => {
    const page = mount(undefined, updated)

    expect(storedFrom(page.current().layout)).toEqual(storedFrom(deriveLayout(updated)))
    await waitFor(() => expect(page.current().loaded).toBe(true))
    expect(storedFrom(page.current().layout)).toEqual(storedFrom(deriveLayout(updated)))
  })

  it('writes nothing on load, and nothing when the window is resized', async () => {
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const page = mount(undefined, updated)

    await waitFor(() => expect(page.current().loaded).toBe(true))
    window.dispatchEvent(new Event('resize'))
    await act(() => Promise.resolve())

    expect(set).not.toHaveBeenCalled()
    expect(await stored()).toBeUndefined()
  })

  it('follows the settings until the first change, as when Weather is switched on from another device', async () => {
    const page = mount()
    await waitFor(() => expect(page.current().loaded).toBe(true))
    expect(page.current().layout.widgets).toHaveLength(1)

    page.withSettings(updated)

    await waitFor(() => expect(page.current().layout.widgets).toHaveLength(2))
  })

  it('stores what was on screen when it is committed unchanged, and only in sync:layout', async () => {
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const page = mount(undefined, updated)
    const layout = await loaded(page)

    await page.commit(layout)

    await waitFor(async () =>
      expect(JSON.stringify(await stored())).toBe(
        JSON.stringify(storedFrom(deriveLayout(updated))),
      ),
    )
    // The settings are not touched, so v0.2.3 on another device reads exactly what it did.
    expect(writtenKeys(set)).toEqual(['layout'])
  })

  it('stores the Widgets that were on screen with the ids they had, and the options waiting', async () => {
    const page = mount(undefined, SETTINGS)
    const layout = await loaded(page)

    await page.commit(layout)

    await waitFor(async () =>
      expect((await storedLayout()).widgets.map((widget) => widget.id)).toEqual(['clock000']),
    )
    expect((await storedLayout()).waiting?.weather).toBeDefined()
  })

  it('stores a Layout with no Widgets when the last is removed, so the settings do not bring it back', async () => {
    const page = mount(undefined, SETTINGS)
    const layout = await loaded(page)

    await page.commit({ ...layout, widgets: [] })
    await waitFor(async () => expect((await storedLayout()).widgets).toEqual([]))

    // The next page to open, with the same settings, draws the stored empty Layout.
    const next = mount(undefined, SETTINGS)
    await loaded(next)
    expect(next.current().layout.widgets).toEqual([])
  })

  it('draws the stored Layout, not the settings’, once there is one, and settings that change later change nothing', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const page = mount(undefined, { ...SETTINGS, clock: { ...SETTINGS.clock, enabled: false } })

    const layout = await loaded(page)
    expect(layout.widgets).toHaveLength(2)

    page.withSettings(SETTINGS)
    expect(page.current().layout.widgets.map((widget) => widget.kind)).toEqual(['known', 'known'])
    expect(storedFrom(page.current().layout)).toEqual(exampleLayout())
  })
})

describe('useLayout, over a Layout from a newer version', () => {
  const newer = { snapTo: 'cells', v: 2, widgets: exampleLayout().widgets }

  it('is read-only, shows what it can, and writes nothing on commit', async () => {
    await fakeBrowser.storage.sync.set({ layout: newer })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const onRejected = vi.fn()
    const page = mount({ onRejected })
    const layout = await loaded(page)

    expect(page.current().readOnly).toBe(true)
    expect(layout.widgets).toHaveLength(2)

    await page.commit({ ...layout, widgets: [] })

    expect(set).not.toHaveBeenCalled()
    expect(onRejected).not.toHaveBeenCalled()
    expect(await stored()).toEqual(newer)
  })

  it.each([
    ['a newer version', { v: 2, widgets: [] }],
    ['a value with no shape to read', 'a layout'],
  ])(
    'turns read-only when %s arrives while the page is open, with no commit made',
    async (_, raw) => {
      await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
      const page = mount()
      await loaded(page)
      expect(page.current().readOnly).toBe(false)

      await fakeBrowser.storage.sync.set({ layout: raw })

      await waitFor(() => expect(page.current().readOnly).toBe(true))
    },
  )

  it('does not write over a newer Layout that arrived after the read', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const onRejected = vi.fn()
    const page = mount({ onRejected })
    const layout = await loaded(page)
    expect(page.current().readOnly).toBe(false)

    // Another device syncs a newer Layout in; this page's copy of it has not been told yet.
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    await fakeBrowser.storage.sync.set({ layout: newer })
    set.mockClear()
    await page.commit({ ...layout, widgets: [] })

    await waitFor(() => expect(page.current().readOnly).toBe(true))
    expect(set).not.toHaveBeenCalled()
    expect(onRejected).not.toHaveBeenCalled()
    expect(await stored()).toEqual(newer)
  })

  it.each([
    ['something that is not an object', 'a layout'],
    ['an object with no Widgets', { v: 1 }],
    ['Widgets that are not a list', { v: 1, widgets: { clock: {} } }],
    ['a `v` that is not a version', { v: 'one', widgets: [] }],
  ])('is read-only for %s, and writes nothing', async (_, raw) => {
    await fakeBrowser.storage.sync.set({ layout: raw })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const page = mount()
    const layout = await loaded(page)

    expect(page.current().readOnly).toBe(true)
    expect(layout.widgets).toEqual([])

    await page.commit(layout)

    expect(set).not.toHaveBeenCalled()
    expect(await stored()).toEqual(raw)
  })
})

describe('useLayout, when the browser rejects a save', () => {
  /** What Chrome says when an item is over 8,192 bytes. */
  const overQuota = () =>
    vi
      .spyOn(fakeBrowser.storage.sync, 'set')
      .mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))

  it('puts back the stored Layout and says so, for a Layout that is too big', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const onRejected = vi.fn()
    const page = mount({ onRejected })
    const layout = await loaded(page)
    overQuota()

    await page.commit({ ...layout, widgets: [widgetAt(layout, 0)] })

    await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
    // What is on screen is what is stored again: both Widgets.
    await waitFor(() => expect(page.current().layout.widgets).toHaveLength(2))
    expect(page.current().readOnly).toBe(false)
    expect(await stored()).toEqual(exampleLayout())
  })

  it('goes on saving after a rejection', async () => {
    await fakeBrowser.storage.sync.set({ layout: exampleLayout() })
    const onRejected = vi.fn()
    const page = mount({ onRejected })
    const layout = await loaded(page)
    const rejecting = overQuota()
    await page.commit({ ...layout, widgets: [] })
    await waitFor(() => expect(onRejected).toHaveBeenCalled())
    rejecting.mockRestore()

    await page.commit({ ...layout, widgets: [widgetAt(layout, 0)] })

    await waitFor(async () => expect((await storedLayout()).widgets).toHaveLength(1))
  })
})
