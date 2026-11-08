import { act, render, renderHook, waitFor } from '@testing-library/preact'
import { h } from 'preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_BACKGROUND } from '@/backdrop/storage'
import { useBackground } from '@/backdrop/useBackground'
import { useFavourites } from '@/backdrop/useFavourites'
import {
  drop,
  dropKeys,
  move,
  nudge,
  pickUp,
  pickUpKeys,
  pickUpResize,
  stretch,
} from '@/components/EditMode/moveSession'
import { checkLayout } from '@/layout/check'
import { deriveLayout } from '@/layout/derive'
import { EXAMPLE_LAYOUT_JSON, exampleLayout } from '@/layout/fixtures'
import { addWidget, removeWidget, restoreWidget, setOptions } from '@/layout/ops'
import { layoutItem } from '@/layout/storage'
import type { Layout } from '@/layout/types'
import { useLayout } from '@/layout/useLayout'
import { answerWelcome } from '@/onboarding/answerWelcome'
import { MARKS, NEWS } from '@/onboarding/callouts'
import { dismissNews } from '@/onboarding/dismissNews'
import { recordInstall } from '@/onboarding/install'
import { type Onboarding, onboardingItem } from '@/onboarding/storage'
import { recordSeen } from '@/onboarding/useSeen'
import { MANIFEST_CACHE_SHAPE, manifestCache, photoState } from '@/photos/storage'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { deleteIcon, saveIcon } from '@/quickDial/iconStorage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { createWriteQueue } from '@/storage/writeQueue'
import { makeManifest, makePhoto } from '@/test/fixtures'
import { weatherDefinition } from '@/widgets/Weather/definition'
import type { DefinitionOf } from '@/widgetSystem/definition'
import { writeOptions } from '@/widgetSystem/options'

import { asV023, asV030, saveLikeV023, saveLikeV030 } from './compat'

const PHASE_3_LAYOUT = {
  v: 1,
  widgets: [
    { col: 1, h: 2, id: 'clock', options: {}, row: 1, type: 'clock', w: 3 },
    {
      col: 5,
      h: 2,
      id: 'date',
      options: { format: 'long', showWeekday: true },
      row: 1,
      type: 'date',
      w: 3,
    },
    {
      col: 9,
      h: 3,
      id: 'analog',
      options: { face: 'roman', showSeconds: true },
      row: 1,
      type: 'analog-clock',
      w: 3,
    },
    {
      col: 1,
      h: 3,
      id: 'bookmarks',
      options: { folderId: 'bar', folderTitle: 'Bookmarks bar', showFolderName: true },
      row: 4,
      type: 'bookmarks',
      w: 4,
    },
    {
      col: 6,
      h: 3,
      id: 'dial',
      options: { icon: 'abcdefgh', label: 'Example', newTab: false, url: 'https://example.com' },
      row: 4,
      type: 'quick-dial',
      w: 5,
    },
  ],
}

/** Add a row here whenever phase 3 adds a synced write that a v0.3.0 device must survive. */
const V030_LAYOUT_WRITES: {
  change?: Parameters<typeof saveLikeV030>[1]
  name: string
  rawSync?: Record<string, unknown>
  write?: () => Promise<Awaited<ReturnType<typeof asV030>>>
}[] = [
  {
    change: { col: 1, id: 'clock', kind: 'move', row: 7 } as const,
    name: 'a v0.3.0 Clock move keeps all four newer Widget types byte for byte',
    rawSync: { layout: PHASE_3_LAYOUT },
  },
  {
    name: 'add an Analog clock through the page commit; v0.3.0 keeps it byte for byte',
    write: async () => {
      await fakeBrowser.storage.sync.clear()
      await settingsItem.setValue(SEED)
      const page = {} as ReturnType<typeof useLayout>
      function Probe() {
        Object.assign(page, useLayout(SEED))
        return null
      }
      render(h(Probe, {}))
      await waitFor(() => expect(page.loaded).toBe(true))
      const added = addWidget({ layout: page.layout, readOnly: page.readOnly }, 'analog-clock')
      if (!added.ok) throw new Error(`could not add Analog clock: ${added.reason}`)
      await act(async () => {
        await page.commit(added.layout)
      })
      await waitFor(async () =>
        expect(await fakeBrowser.storage.sync.get('layout')).toHaveProperty('layout'),
      )
      return asV030(await fakeBrowser.storage.sync.get(null))
    },
  },
  {
    name: 'add and configure a Quick dial through the page commit; v0.3.0 keeps it byte for byte',
    write: async () => {
      await fakeBrowser.storage.sync.clear()
      await settingsItem.setValue(SEED)
      const page = {} as ReturnType<typeof useLayout>
      function Probe() {
        Object.assign(page, useLayout(SEED))
        return null
      }
      render(h(Probe, {}))
      await waitFor(() => expect(page.loaded).toBe(true))
      const added = addWidget({ layout: page.layout, readOnly: page.readOnly }, 'quick-dial')
      if (!added.ok) throw new Error(`could not add Quick dial: ${added.reason}`)
      const configured = setOptions({ layout: added.layout, readOnly: false }, added.id, {
        icon: 'abcdefgh',
        label: 'Example',
        newTab: false,
        url: 'https://example.com/',
      })
      if (!configured.ok) throw new Error(`could not configure Quick dial: ${configured.reason}`)
      await act(async () => {
        await page.commit(configured.layout)
      })
      await waitFor(async () =>
        expect(await fakeBrowser.storage.sync.get('layout')).toHaveProperty('layout'),
      )
      return asV030(await fakeBrowser.storage.sync.get(null))
    },
  },
]

/** Every new synced item write goes through the page hook and leaves the released settings alone. */
const PHASE_3_SYNC_ITEM_WRITES = [
  {
    key: 'background',
    name: 'save Favourites only through its commit path and keep it byte for byte for v0.3.0',
    write: async () => {
      let commit = (_value: typeof DEFAULT_BACKGROUND) => {}
      function Commit() {
        const item = useBackground()
        commit = item.set
        return h('output', null, String(item.loaded))
      }
      const page = render(h(Commit, null))
      await waitFor(() => expect(page.container.textContent).toBe('true'))
      await act(async () => commit({ ...DEFAULT_BACKGROUND, favouritesOnly: true }))
      await waitFor(async () =>
        expect((await fakeBrowser.storage.sync.get('background')).background).toMatchObject({
          favouritesOnly: true,
        }),
      )
    },
  },
  {
    key: 'icon:',
    name: 'save a Quick dial icon item; frozen readers leave Layout and settings alone',
    write: async () => {
      const id = await saveIcon('data:image/webp;base64,YQ==')
      return `icon:${id}`
    },
  },
  {
    expectedPresent: false,
    key: 'icon:abcdefgh',
    name: 'delete a Quick dial icon through its guarded path; frozen readers leave it removed',
    write: async () => {
      await fakeBrowser.storage.sync.set({
        'icon:abcdefgh': { data: 'data:image/webp;base64,YQ==', v: 1 },
      })
      await deleteIcon('abcdefgh')
      return 'icon:abcdefgh'
    },
  },
  {
    key: 'favourites',
    name: 'save favourites through their commit path',
    write: async () => {
      let commit = (_value: { ids: string[]; v: 1 }) => {}
      function Commit() {
        const item = useFavourites()
        commit = item.set
        return h('output', null, String(item.loaded))
      }
      const page = render(h(Commit, null))
      await waitFor(() => expect(page.container.textContent).toBe('true'))
      await act(async () => commit({ ids: ['photo-1'], v: 1 }))
      await waitFor(async () =>
        expect((await fakeBrowser.storage.sync.get('favourites')).favourites).toEqual({
          ids: ['photo-1'],
          v: 1,
        }),
      )
    },
  },
]

describe('the frozen v0.3.0 reader', () => {
  it.each(V030_LAYOUT_WRITES)('$name', async ({ change, rawSync, write }) => {
    const after = write ? await write() : await saveLikeV030(rawSync!, change!)

    if (write) {
      const added = after.raw.layout.widgets.find((widget) =>
        ['analog-clock', 'quick-dial'].includes((widget as { type?: string }).type ?? ''),
      ) as { type?: string } | undefined
      if (added?.type === 'quick-dial') {
        expect(added).toMatchObject({
          options: {
            icon: 'abcdefgh',
            label: 'Example',
            newTab: false,
            url: 'https://example.com/',
          },
        })
      } else {
        expect(added).toMatchObject({
          options: { face: 'ticks', showDate: false, showSeconds: true },
        })
      }
      expect(after.layout.widgets.filter((widget) => widget.kind === 'unknown')).toHaveLength(1)
      expect(after.raw.settings).toEqual(SEED)
    } else {
      expect(after.layout.widgets.filter((widget) => widget.kind === 'unknown')).toHaveLength(4)
      expect(JSON.stringify(after.raw.layout.widgets.slice(1))).toBe(
        JSON.stringify(PHASE_3_LAYOUT.widgets.slice(1)),
      )
      expect(after.raw.layout.widgets[0]).toMatchObject({ col: 1, id: 'clock', row: 7 })
    }
  })

  it.each(PHASE_3_SYNC_ITEM_WRITES)('$name', async ({ expectedPresent = true, key, write }) => {
    await fakeBrowser.storage.sync.clear()
    await settingsItem.setValue(SEED)
    const settingsBefore = JSON.stringify((await fakeBrowser.storage.sync.get('settings')).settings)

    const writtenKey = (await write()) ?? key
    const stored = await fakeBrowser.storage.sync.get(null)

    const present = Object.keys(stored).some(
      (itemKey) => itemKey === writtenKey || itemKey.startsWith(writtenKey),
    )
    expect(present).toBe(expectedPresent)
    expect(JSON.stringify(stored.settings)).toBe(settingsBefore)
    expect((await asV023(stored)).settings).toEqual(stored.settings)
    const frozen = await asV030(stored)
    expect(frozen.settings).toEqual(stored.settings)
    expect(frozen.layout.widgets).toEqual([])
    expect(frozen.raw.background).toEqual(stored.background)
    const afterFrozenReads = await fakeBrowser.storage.sync.get(null)
    expect(
      Object.keys(afterFrozenReads).some(
        (itemKey) => itemKey === writtenKey || itemKey.startsWith(writtenKey),
      ),
    ).toBe(expectedPresent)
  })

  it('keeps unknown Widget types when removing a different Widget', async () => {
    const after = await saveLikeV030({ layout: PHASE_3_LAYOUT }, { id: 'clock', kind: 'remove' })

    expect(after.layout.widgets.filter((widget) => widget.kind === 'unknown')).toHaveLength(4)
    expect(JSON.stringify(after.raw.layout.widgets)).toBe(
      JSON.stringify(PHASE_3_LAYOUT.widgets.slice(1)),
    )
  })

  it('does not write over a Layout with a newer version', async () => {
    const layout = { ...PHASE_3_LAYOUT, v: 2 }
    const after = await saveLikeV030({ layout }, { col: 5, id: 'clock', kind: 'move', row: 5 })

    expect(after.layout.readOnly).toBe(true)
    expect(after.raw.layout).toEqual(layout)
  })

  it.each([0, -1, 1.5, '1'])('does not write over a Layout with invalid v %s', async (v) => {
    const layout = { ...PHASE_3_LAYOUT, v }
    const after = await saveLikeV030({ layout }, { col: 5, id: 'clock', kind: 'move', row: 5 })

    expect(after.layout.readOnly).toBe(true)
    expect(after.raw.layout).toEqual(layout)
  })

  it('reads all four phase 3 Widgets as unknown and leaves v0.2.3 settings and onboarding alone', async () => {
    const rawSync = {
      layout: PHASE_3_LAYOUT,
      onboarding: { dismissed: ['layout'], welcomed: true },
      settings: { ...SETTINGS_0_2_3, v: 1 },
    }
    const v030 = await asV030(rawSync)
    const v023 = await asV023(rawSync)

    expect(v030.layout.widgets.filter((widget) => widget.kind === 'unknown')).toHaveLength(4)
    expect(v023.fellBack).toBe(false)
    expect(v023.settings).toEqual(rawSync.settings)
    expect(v023.onboarding).toEqual(rawSync.onboarding)
  })
})

/** What a v0.2.3 device wrote: the shape the frozen reader accepts as it stands. */
const SETTINGS_0_2_3 = {
  clock: { enabled: true, hour12: false, showDate: true, showSeconds: false },
  dim: false,
  font: 'geist',
  photos: { frequency: '1h', mode: 'pinned', pinnedId: 'p1', tags: ['coast'] },
  weather: {
    enabled: true,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: false },
      { id: 'condition', shown: true },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' },
    unit: 'celsius',
  },
}

describe('the frozen v0.2.3 reader (the four cases LR-15 ran)', () => {
  it('reads settings that carry a top-level `v` unchanged', async () => {
    const proposed = { ...SETTINGS_0_2_3, v: 1 }

    const { fellBack, settings } = await asV023({ settings: proposed })

    expect(fellBack).toBe(false)
    expect(settings).toEqual(proposed)
  })

  it('keeps `v` when v0.2.3 saves a change of its own', async () => {
    const after = await saveLikeV023({ settings: { ...SETTINGS_0_2_3, v: 1 } }, { font: 'system' })

    expect(after.settings).toEqual({ ...SETTINGS_0_2_3, font: 'system', v: 1 })
  })

  it('falls back to the defaults when `clock` is missing', async () => {
    const withoutClock = Object.fromEntries(
      Object.entries(SETTINGS_0_2_3).filter(([key]) => key !== 'clock'),
    )

    const { fellBack, settings } = await asV023({ settings: withoutClock })

    expect(fellBack).toBe(true)
    expect(settings.clock.enabled).toBe(true)
    expect(settings.font).toBe('system')
  })

  it('falls back to the defaults for a `weather.unit` it does not know', async () => {
    const kelvin = { ...SETTINGS_0_2_3, weather: { ...SETTINGS_0_2_3.weather, unit: 'kelvin' } }

    const { fellBack, settings } = await asV023({ settings: kelvin })

    expect(fellBack).toBe(true)
    expect(settings.weather.enabled).toBe(false)
    expect(settings.font).toBe('system')
  })

  it('drops a key added inside `clock` without falling back', async () => {
    const extra = { ...SETTINGS_0_2_3, clock: { ...SETTINGS_0_2_3.clock, layoutHint: 'x' } }

    const { fellBack, settings } = await asV023({ settings: extra })

    expect(fellBack).toBe(false)
    expect(settings.clock).toEqual(SETTINGS_0_2_3.clock)
    expect(settings.font).toBe('geist')
  })
})

/**
 * What a device on the real, current code has stored before a row's write: not the defaults, so
 * that a write which resets the photo, the font or the dim shows up.
 */
const SEED: Settings = {
  ...DEFAULT_SETTINGS,
  dim: false,
  font: 'geist',
  photos: { frequency: '1h', mode: 'pinned', pinnedId: 'p1', tags: ['coast'] },
}

const SEED_ONBOARDING: Onboarding = { dismissed: ['weather'], welcomed: false }

/** Something both a person and the reader can tell a place from the defaults by. */
const VICTORIA = { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' }

const changeSettings = (change: (settings: Settings) => Settings) => async () =>
  settingsItem.setValue(change(await settingsItem.getValue()))

/** The stored Layout of LR-15's example, through the real item: a Clock and a Weather. */
const storeExampleLayout = async (): Promise<Layout> => {
  await layoutItem.setValue(checkLayout(exampleLayout()))
  const layout = await layoutItem.getValue()
  if (!layout) throw new Error('the Layout was not stored')
  return layout
}

/** The Layout the real item reads back, with `change` made to it, stored through the item. */
const changeLayout = (change: (layout: Layout) => Layout) => async () => {
  await layoutItem.setValue(change(await storeExampleLayout()))
}

/** Commits a Layout through the same hook the page uses. */
async function commitThroughPage(next: Layout, type: string): Promise<void> {
  const page = {} as ReturnType<typeof useLayout>
  function Probe() {
    Object.assign(page, useLayout(DEFAULT_SETTINGS))
    return null
  }
  const { unmount } = render(h(Probe, {}))
  await waitFor(() => expect(page.loaded).toBe(true))
  await act(async () => {
    page.commit(next)
  })
  await waitFor(async () => {
    const { layout } = await fakeBrowser.storage.sync.get('layout')
    expect(
      (layout as { widgets?: { type?: string }[] } | undefined)?.widgets?.some(
        (widget) => widget.type === type,
      ),
    ).toBe(true)
  })
  unmount()
}

const PHASE_3_WRITES = [
  {
    expectedChangedKeys: [],
    expectedOptions: undefined,
    expectedType: undefined,
    name: 'pick a gallery photo through rotation; only local photo state changes',
    write: async () => {
      await fakeBrowser.storage.sync.clear()
      await settingsItem.setValue(SEED)
      await manifestCache.setValue({
        data: makeManifest([makePhoto('a'), makePhoto('b')]),
        etag: null,
        fetchedAt: Date.now(),
        shape: MANIFEST_CACHE_SHAPE,
      })
      await photoState.setValue({ bag: ['b'], currentId: 'a', shownAt: Date.now() })
      const before = await fakeBrowser.storage.sync.get(null)
      const { result } = renderHook(() => usePhotoRotation(SEED.photos))
      await waitFor(() => expect(result.current.photo?.id).toBe('a'))
      await act(async () => result.current.select('b'))
      await waitFor(async () => expect((await photoState.getValue())?.currentId).toBe('b'))
      return { after: await fakeBrowser.storage.sync.get(null), before }
    },
  },
  {
    expectedChangedKeys: ['background'],
    expectedOptions: undefined,
    expectedType: undefined,
    name: 'choose a background through its page hook; v0.2.3 settings stay byte-equal',
    write: async () => {
      await settingsItem.setValue(SEED)
      await onboardingItem.setValue(SEED_ONBOARDING)
      const before = await fakeBrowser.storage.sync.get(null)
      const settingsWrite = vi.spyOn(settingsItem, 'setValue')
      let commit = (_value: typeof DEFAULT_BACKGROUND) => {}
      function Commit() {
        const item = useBackground()
        commit = item.set
        return h('output', null, String(item.loaded))
      }
      const page = render(h(Commit, null))
      await waitFor(() => expect(page.container.textContent).toBe('true'))
      await act(async () => commit({ ...DEFAULT_BACKGROUND, colour: '#123456', kind: 'colour' }))
      await waitFor(async () =>
        expect((await fakeBrowser.storage.sync.get('background')).background).toMatchObject({
          colour: '#123456',
          kind: 'colour',
          v: 1,
        }),
      )
      expect(settingsWrite).not.toHaveBeenCalled()
      settingsWrite.mockRestore()
      return { after: await fakeBrowser.storage.sync.get(null), before }
    },
  },
  {
    expectedChangedKeys: ['layout'],
    expectedOptions: { format: 'short', monthGrid: true, showYear: false, weekNumbers: false },
    expectedType: 'date',
    name: 'adding a Date writes sync:layout only through the page commit path',
    write: async () => {
      await settingsItem.setValue(SEED)
      await onboardingItem.setValue(SEED_ONBOARDING)
      const layout = await storeExampleLayout()
      const before = await fakeBrowser.storage.sync.get(null)
      const added = addWidget({ layout, readOnly: false }, 'date')
      if (!added.ok) throw new Error(`the add was refused: ${added.reason}`)
      await commitThroughPage(added.layout, 'date')
      return { after: await fakeBrowser.storage.sync.get(null), before }
    },
  },
  {
    expectedChangedKeys: ['layout'],
    expectedOptions: { folder: 'bar', openInNewTab: false, showFolderName: true },
    expectedType: 'bookmarks',
    name: 'adding Bookmarks writes sync:layout only through the page commit path',
    write: async () => {
      await settingsItem.setValue(SEED)
      await onboardingItem.setValue(SEED_ONBOARDING)
      const layout = await storeExampleLayout()
      const before = await fakeBrowser.storage.sync.get(null)
      const added = addWidget({ layout, readOnly: false }, 'bookmarks')
      if (!added.ok) throw new Error(`the add was refused: ${added.reason}`)
      await commitThroughPage(added.layout, 'bookmarks')
      return { after: await fakeBrowser.storage.sync.get(null), before }
    },
  },
]

describe('phase 3 synced writes', () => {
  it.each(PHASE_3_WRITES)('$name', async (row) => {
    const { expectedChangedKeys, expectedOptions, expectedType, write } = row
    const { after: rawSync, before } = await write()

    const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(rawSync)])]
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(rawSync[key]))
      .sort()
    expect(changedKeys).toEqual(expectedChangedKeys)
    expect(rawSync.settings).toEqual(before.settings)
    expect(rawSync.onboarding).toEqual(before.onboarding)
    const { fellBack, settings } = await asV023(rawSync)
    expect(fellBack).toBe(false)
    expect(settings).toEqual(rawSync.settings)
    if (expectedChangedKeys.includes('background')) {
      expect(rawSync.background).toMatchObject({ colour: '#123456', kind: 'colour', v: 1 })
      expect((await asV030(rawSync)).raw.background).toEqual(rawSync.background)
    }
    if (expectedChangedKeys.includes('layout')) {
      expect(rawSync.layout).toMatchObject({
        v: 1,
        widgets: expect.arrayContaining([expect.objectContaining({ type: expectedType })]),
      })
      const v030 = await asV030(rawSync)
      expect(v030.layout.widgets.filter((widget) => widget.kind === 'unknown')).toHaveLength(1)
      expect(
        v030.raw.layout.widgets.find(
          (widget) => (widget as { type?: string }).type === expectedType,
        ),
      ).toMatchObject({
        options: expectedOptions,
        type: expectedType,
      })
    }
  })
})

const LEFT = { cols: -1, rows: 0 }
const RIGHT = { cols: 1, rows: 0 }
const DOWN = { cols: 0, rows: 1 }

/** The Clock of the example Layout. */
function clockOf(layout: Layout) {
  const clock = layout.widgets.find(
    (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
  )
  if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
  return clock.placed
}

/**
 * What a person does at the keyboard, with the real session the page uses: picks the Clock up,
 * presses these keys (an arrow moves it, Shift and an arrow resizes it), and puts it down. The
 * Layout the put-down hands to `commit`.
 */
function putDownFromKeyboard(
  layout: Layout,
  keys: { by: { cols: number; rows: number }; resize?: boolean }[],
): Layout {
  const held = pickUpKeys({ layout, readOnly: false }, clockOf(layout).id)
  if (!held) throw new Error('the Clock could not be picked up')
  const moved = keys.reduce(
    (session, { by, resize }) => (resize ? stretch : nudge)(session, by),
    held,
  )
  const next = dropKeys(moved, { layout, readOnly: false })
  if (!next) throw new Error('the put-down was refused')
  return next
}

const changeOnboarding = (change: (record: Onboarding) => Onboarding) => async () =>
  onboardingItem.setValue(change((await onboardingItem.getValue()) ?? SEED_ONBOARDING))

type PhaseTwoWrite = {
  /**
   * What photos, font and dim hold afterwards where the write changes them; whatever it does
   * not name must still be what SEED has.
   */
  changes?: Partial<Pick<Settings, 'dim' | 'font' | 'photos'>>
  /**
   * The write starts from no synced onboarding record, so it has no `dismissed` ids to keep.
   */
  fromNoRecord?: boolean
  /**
   * The write is to `sync:layout` and nothing else: `sync:settings` and `sync:onboarding` are
   * exactly as they were, and the Layout is stored with `v: 1`.
   */
  layoutOnly?: boolean
  name: string
  /**
   * The write is to `sync:onboarding` and nothing else: `sync:settings` is exactly as it was and
   * there is no `sync:layout`, and the record has gained the one id and kept the rest.
   */
  onboardingOnly?: boolean
  /** IDs added to onboarding by a New mark; a single call records all of them. */
  seenIds?: string[]
  /**
   * The write must leave `v: 1` at the top of the settings, which stored settings from v0.2.3
   * (the row starts from those) do not have.
   */
  stampsVersion?: boolean
  /**
   * The write is to `sync:onboarding` and nothing else, and the record is the seed's with
   * `welcomed` turned on: no id gained, none lost. `sync:settings` is exactly as it was and there
   * is no `sync:layout`.
   */
  welcomeOnly?: boolean
  /** The write, made through the real storage items, as the page makes it. */
  write: () => Promise<void>
}

/**
 * Every write the extension can make to `sync:settings` and `sync:onboarding`, replayed through
 * the real items and read back through the frozen v0.2.3 reader. This is the standing guard
 * against resetting a device that is still on v0.2.3 (LR-15). Two things are checked for each
 * row: that v0.2.3 still reads what was written, and that the write changed only what phase 2
 * is allowed to change (see below), which the reader alone would not catch.
 *
 * What v0.2.3 does with what it reads: the settings are a loose object, so it keeps a top-level
 * key it does not know (`v`, `layout`) and writes it back on its own saves. It falls back to the
 * defaults only when a known block is missing or wrong. A key added inside `clock`, `photos` or
 * `place` is stripped, silently, the next time v0.2.3 saves.
 *
 * What phase 2 may write to `sync:settings` is only the top-level `v: 1`, `clock.hour12`, and
 * what v0.2.3 already writes (photos, dim, font, as the panel does now). It never removes a
 * block, never gives a value v0.2.3 does not know, never adds a key inside a block. Removing a
 * Clock writes only `sync:layout`; it never writes `clock.enabled`. `sync:onboarding` only gains
 * ids in `dismissed`. `sync:layout` is written only by the rows marked `layoutOnly`, which must
 * leave the settings and onboarding exactly as they were; v0.2.3 never reads or writes it (see
 * the tests below the table).
 *
 * `recordInstall('install')` writes only `local:onboarding`, which is not synced, so it is
 * correctly not a row. The "answer the welcome" row starts from a synced record, where a real
 * new install starts from `local:onboarding`; the shape is the same.
 *
 * A PR that adds a write adds a row here, in the same change.
 */
const PHASE_2_WRITES: PhaseTwoWrite[] = [
  {
    changes: { photos: { ...SEED.photos, frequency: '6h', mode: 'cycle' } },
    name: 'choose how often photos change',
    write: changeSettings((s) => ({
      ...s,
      photos: { ...s.photos, frequency: '6h', mode: 'cycle' },
    })),
  },
  {
    changes: { photos: { ...SEED.photos, mode: 'pinned', pinnedId: 'p2' } },
    name: 'hold the current photo with Never',
    write: changeSettings((s) => ({
      ...s,
      photos: { ...s.photos, mode: 'pinned', pinnedId: 'p2' },
    })),
  },
  {
    changes: { photos: { ...SEED.photos, mode: 'cycle' } },
    name: 'resume cycling',
    write: changeSettings((s) => ({ ...s, photos: { ...s.photos, mode: 'cycle' } })),
  },
  {
    changes: { photos: { ...SEED.photos, tags: ['city', 'coast'] } },
    name: 'filter photos by tag',
    write: changeSettings((s) => ({ ...s, photos: { ...s.photos, tags: ['city', 'coast'] } })),
  },
  {
    changes: { dim: true },
    name: 'turn the dimming on',
    write: changeSettings((s) => ({ ...s, dim: true })),
  },
  {
    changes: { font: 'instrument-serif' },
    name: 'choose a font',
    write: changeSettings((s) => ({ ...s, font: 'instrument-serif' })),
  },
  {
    name: 'switch the clock to 24-hour time (clock.hour12)',
    write: changeSettings((s) => ({ ...s, clock: { ...s.clock, hour12: !s.clock.hour12 } })),
  },
  {
    changes: { font: 'instrument-serif' },
    name: 'the first save after an update from v0.2.3 adds the top-level `v: 1` (W3)',
    stampsVersion: true,
    write: async () => {
      // Settings as v0.2.3 left them: the current shape, and no `v`.
      const settings = (await fakeBrowser.storage.sync.get('settings')).settings as Settings
      await fakeBrowser.storage.sync.set({
        settings: Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'v')),
      })
      await changeSettings((s) => ({ ...s, font: 'instrument-serif' }))()
    },
  },
  {
    changes: { photos: { ...SEED.photos, pinnedId: 'p19' } },
    name: 'a burst of saves through the write queue (W2: it writes nothing new; the last value wins)',
    write: async () => {
      const writes: (string | null)[] = []
      const queue = createWriteQueue(async (value: Settings) => {
        writes.push(value.photos.pinnedId)
        await settingsItem.setValue(value)
      })
      const base = await settingsItem.getValue()
      // Twenty pins in a row, the way the page makes them, each a different photo: the first goes
      // straight out, and of the nineteen behind it only the last is written.
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          queue.save({ ...base, photos: { ...base.photos, pinnedId: `p${i}` } }),
        ),
      )
      expect(writes).toEqual(['p0', 'p19'])
    },
  },
  {
    layoutOnly: true,
    name: 'the first change stores the whole Layout (sync:layout)',
    write: async () => {
      await layoutItem.setValue(checkLayout(exampleLayout()))
    },
  },
  {
    layoutOnly: true,
    name: 'remove the Clock: only sync:layout is written, never clock.enabled',
    write: changeLayout((layout) => ({
      ...layout,
      widgets: layout.widgets.filter(
        (widget) => widget.kind === 'known' && widget.placed.type !== 'clock',
      ),
    })),
  },
  {
    layoutOnly: true,
    name: 'remove the Clock with × or Delete (W24, removeWidget): only sync:layout, never clock.enabled',
    write: changeLayout((layout) => {
      const clock = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
      )
      if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
      const removed = removeWidget({ layout, readOnly: false }, clock.placed.id)
      if (!removed.ok) throw new Error(`the removal was refused: ${removed.reason}`)
      return removed.layout
    }),
  },
  {
    layoutOnly: true,
    name: 'Undo that removal (W24, restoreWidget): sync:layout alone, and the Clock is back as it was',
    write: async () => {
      const layout = await storeExampleLayout()
      const clock = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
      )
      if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
      const removed = removeWidget({ layout, readOnly: false }, clock.placed.id)
      if (!removed.ok) throw new Error(`the removal was refused: ${removed.reason}`)
      await layoutItem.setValue(removed.layout)
      const restored = restoreWidget({ layout: removed.layout, readOnly: false }, removed.removed)
      if (!restored.ok) throw new Error(`the undo was refused: ${restored.reason}`)
      await layoutItem.setValue(restored.layout)
      expect(
        ((await fakeBrowser.storage.sync.get('layout')).layout as { widgets: unknown[] }).widgets,
      ).toContainEqual(clock.placed)
    },
  },
  {
    layoutOnly: true,
    name: 'delete every Widget: an empty Layout is stored, not removed',
    write: changeLayout((layout) => ({ ...layout, widgets: [] })),
  },
  {
    layoutOnly: true,
    name: 'add a Clock or a Weather from the Add menu (addWidget: sync:layout alone, never clock.enabled)',
    write: async () => {
      const first = addWidget({ layout: await storeExampleLayout(), readOnly: false }, 'weather')
      if (!first.ok) throw new Error(`the add was refused: ${first.reason}`)
      const second = addWidget({ layout: first.layout, readOnly: false }, 'clock')
      if (!second.ok) throw new Error(`the add was refused: ${second.reason}`)
      await layoutItem.setValue(second.layout)
    },
  },
  {
    layoutOnly: true,
    name: 'add a Date Widget (addWidget and commit: sync:layout only)',
    write: async () => {
      const added = addWidget({ layout: await storeExampleLayout(), readOnly: false }, 'date')
      if (!added.ok) throw new Error(`the add was refused: ${added.reason}`)
      await commitThroughPage(added.layout, 'date')
    },
  },
  {
    layoutOnly: true,
    name: 'the first add after an update with the Clock off: the waiting options are used and removed in one Layout write',
    write: async () => {
      // The Layout worked out from settings stored by v0.2.3 with the Clock off keeps its options.
      const derived = deriveLayout({ ...SEED, clock: { ...SEED.clock, enabled: false } })
      expect(derived.waiting).toHaveProperty('clock')
      const added = addWidget({ layout: derived, readOnly: false }, 'clock')
      if (!added.ok) throw new Error(`the add was refused: ${added.reason}`)
      expect(added.layout.waiting).not.toHaveProperty('clock')
      await layoutItem.setValue(added.layout)
    },
  },
  {
    layoutOnly: true,
    name: 'change a Widget’s options (sync:layout; the Clock’s blocks in settings stay frozen)',
    write: changeLayout((layout) => ({
      ...layout,
      widgets: layout.widgets.map((widget) =>
        widget.kind === 'known' && widget.placed.type === 'clock'
          ? {
              ...widget,
              placed: {
                ...widget.placed,
                options: { ...widget.placed.options, showDate: true, showSeconds: true },
              },
            }
          : widget,
      ),
    })),
  },
  {
    layoutOnly: true,
    name: 'change a Weather’s options in its popover (writeOptions then setOptions: sync:layout alone)',
    write: changeLayout((layout) => {
      const weather = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'weather',
      )
      if (weather?.kind !== 'known') throw new Error('the example Layout has a Weather')
      const options = writeOptions(weatherDefinition, weather.placed.options, {
        unit: 'fahrenheit',
      })
      const changed = setOptions({ layout, readOnly: false }, weather.placed.id, options)
      if (!changed.ok) throw new Error(`the change was refused: ${changed.reason}`)
      return changed.layout
    }),
  },
  {
    layoutOnly: true,
    name: 'pick from a Widget list (OptionsForm change through writeOptions, setOptions and sync:layout)',
    write: async () => {
      await storeExampleLayout()
      const { result, unmount } = renderHook(() => useLayout(SEED))
      await waitFor(() => expect(result.current.loaded).toBe(true))
      const layout = result.current.layout
      const weather = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'weather',
      )
      if (weather?.kind !== 'known') throw new Error('the example Layout has a Weather')
      const definition = {
        ...weatherDefinition,
        options: [
          ...weatherDefinition.options,
          {
            control: 'pick' as const,
            default: 'bar',
            emptyText: 'No folders',
            failedText: 'Could not load folders',
            id: 'folder',
            label: 'Folder',
            load: async () => [{ label: 'Bookmarks bar', value: 'bar' }],
          },
        ],
      }
      const options = writeOptions(
        definition as unknown as DefinitionOf<Record<string, unknown>>,
        weather.placed.options,
        { folder: 'bar' },
      )
      const changed = setOptions({ layout, readOnly: false }, weather.placed.id, options)
      if (!changed.ok) throw new Error(`the change was refused: ${changed.reason}`)
      act(() => {
        void result.current.commit(changed.layout)
      })
      await waitFor(async () => {
        const saved = await layoutItem.getValue()
        const savedWeather = saved?.widgets.find(
          (widget) => widget.kind === 'known' && widget.placed.type === 'weather',
        )
        expect(savedWeather?.kind === 'known' && savedWeather.placed.options.folder).toBe('bar')
      })
      unmount()
    },
  },
  {
    layoutOnly: true,
    name: 'drag a Widget to a new place (W21: one drop, sync:layout alone, nothing in sync:settings)',
    write: changeLayout((layout) => {
      // The Clock, grabbed at its top left corner, one cell left and one down: as a drop makes it.
      const clock = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
      )
      if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
      const { col, row } = clock.placed
      const held = pickUp({ layout, readOnly: false }, clock.placed.id, {
        col: col - 1,
        row: row - 1,
      })
      if (!held) throw new Error('the Clock could not be picked up')
      const next = drop(move(held, { col: col - 2, row }), { layout, readOnly: false })
      if (!next) throw new Error('the drop was refused')
      // It did move: a row that saved a Layout nothing had changed in would prove nothing.
      const after = next.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.id === clock.placed.id,
      )
      if (after?.kind !== 'known' || after.placed.col !== col - 1 || after.placed.row !== row + 1) {
        throw new Error('the drop did not move the Clock')
      }
      return next
    }),
  },
  {
    layoutOnly: true,
    name: 'resize a Widget by its handle (W22: one drop, sync:layout alone, nothing in sync:settings)',
    write: changeLayout((layout) => {
      // The Clock, held by its handle at the bottom right corner, a column and a row bigger.
      const clock = layout.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
      )
      if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
      const { col, h, id, row, w } = clock.placed
      const held = pickUpResize({ layout, readOnly: false }, id, {
        col: col - 1 + w,
        row: row - 1 + h,
      })
      if (!held) throw new Error('the Clock’s handle could not be picked up')
      const next = drop(move(held, { col: col - 1 + w + 1, row: row - 1 + h + 1 }), {
        layout,
        readOnly: false,
      })
      if (!next) throw new Error('the drop was refused')
      // It did change size: a row that saved a Layout nothing had changed in would prove nothing.
      const after = next.widgets.find(
        (widget) => widget.kind === 'known' && widget.placed.id === id,
      )
      if (after?.kind !== 'known' || after.placed.w !== w + 1 || after.placed.h !== h + 1) {
        throw new Error('the drop did not change the Clock’s size')
      }
      return next
    }),
  },
  {
    layoutOnly: true,
    name: 'move a Widget from the keyboard (W23: pick up, arrows, put down is one write to sync:layout alone)',
    write: changeLayout((layout) => {
      const next = putDownFromKeyboard(layout, [{ by: LEFT }, { by: DOWN }, { by: DOWN }])
      // It did move: a row that saved a Layout nothing had changed in would prove nothing.
      const after = clockOf(next)
      const before = clockOf(layout)
      if (after.col !== before.col - 1 || after.row !== before.row + 2) {
        throw new Error('the put-down did not move the Clock')
      }
      return next
    }),
  },
  {
    layoutOnly: true,
    name: 'resize a Widget from the keyboard (W23: pick up, Shift and arrows, put down is one write to sync:layout alone)',
    write: changeLayout((layout) => {
      const next = putDownFromKeyboard(layout, [
        { by: RIGHT, resize: true },
        { by: DOWN, resize: true },
      ])
      const after = clockOf(next)
      const before = clockOf(layout)
      if (after.w !== before.w + 1 || after.h !== before.h + 1 || after.col !== before.col) {
        throw new Error('the put-down did not resize the Clock')
      }
      return next
    }),
  },
  {
    name: 'the shared 24-hour switch in a popover, after a first Layout write: clock.hour12 only',
    write: async () => {
      await storeExampleLayout()
      await changeSettings((s) => ({ ...s, clock: { ...s.clock, hour12: !s.clock.hour12 } }))()
    },
  },
  {
    name: 'answer the welcome',
    write: changeOnboarding((record) => ({ ...record, welcomed: true })),
  },
  {
    // Skip and "Show me around" both write this and nothing else: the guided tour that follows
    // (W29) is page state and stores nothing (App.tour.test.tsx runs a whole one and checks the
    // synced storage). The page's own function, on the record v0.2.3 stored.
    name: 'answer the welcome, then take the guided tour (W29; answerWelcome: welcomed gained, no id, nothing else)',
    welcomeOnly: true,
    write: changeOnboarding(answerWelcome),
  },
  {
    name: 'dismiss a callout (an id gained in `dismissed`)',
    write: changeOnboarding((record) => ({
      ...record,
      dismissed: [...record.dismissed, 'a-later-callout'],
    })),
  },
  {
    name: 'see the Add menu marks (all unseen IDs gained in one onboarding write)',
    onboardingOnly: true,
    seenIds: MARKS.filter((id) => id === 'clock' || id === 'weather-widget'),
    write: async () => {
      await recordSeen(MARKS.filter((id) => id === 'clock' || id === 'weather-widget'))
    },
  },
  {
    name: 'dismiss the update note about the Layout (W30; dismissNews, from the record v0.2.3 stored: one id gained)',
    onboardingOnly: true,
    write: async () => {
      const note = NEWS.find(({ id }) => id === 'layout')
      if (!note) throw new Error('the news has the update note about the Layout')
      // The page's own function, on the record v0.2.3 stored (SEED_ONBOARDING has its `weather` id).
      await changeOnboarding((record) => dismissNews(record, note.id))()
    },
  },
  {
    fromNoRecord: true,
    name: 'record an update from a version that kept no record',
    write: async () => {
      await fakeBrowser.storage.sync.remove('onboarding')
      await recordInstall('update')
    },
  },
]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The paths at which `after` differs from `before`, one block deep: `dim`, `photos.mode`,
 * `clock.hour12`. A key that is added or removed counts, at the top level or inside a block.
 */
const changedPaths = (before: unknown, after: unknown): string[] => {
  const was = isObject(before) ? before : {}
  const now = isObject(after) ? after : {}
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].flatMap((key) => {
    const [a, b] = [was[key], now[key]]
    if (isObject(a) && isObject(b)) {
      return [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter((inner) => !same(a[inner], b[inner]))
        .map((inner) => `${key}.${inner}`)
    }
    return same(a, b) ? [] : [key]
  })
}

/** Everything phase 2 may change in `sync:settings`; see PHASE_2_WRITES. */
const ALLOWED_PATHS = /^dim$|^font$|^photos\.|^clock\.hour12$|^v$/

describe('what phase 2 may write, read by the frozen v0.2.3 reader', () => {
  beforeEach(async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
  })

  it.each(PHASE_2_WRITES)(
    '$name',
    async ({
      changes,
      fromNoRecord,
      layoutOnly,
      onboardingOnly,
      seenIds,
      stampsVersion,
      welcomeOnly,
      write,
    }) => {
      await write()
      const stored = await fakeBrowser.storage.sync.get(null)

      // Only what phase 2 is allowed to change has changed, and `v` is 1 where there is one.
      const disallowed = changedPaths(SEED, stored.settings).filter(
        (path) => !ALLOWED_PATHS.test(path),
      )
      expect(disallowed).toEqual([])
      if (isObject(stored.settings) && 'v' in stored.settings) expect(stored.settings.v).toBe(1)
      if (stampsVersion) expect(stored.settings).toHaveProperty('v', 1)
      // Removing a Clock, say, is a change to the Layout alone.
      if (layoutOnly) {
        expect(stored.settings).toEqual(SEED)
        expect(stored.onboarding).toEqual(SEED_ONBOARDING)
        expect(stored.layout).toHaveProperty('v', 1)
      }
      if (onboardingOnly) {
        expect(stored.settings).toEqual(SEED)
        expect(stored.layout).toBeUndefined()
        expect(stored.onboarding).toEqual({
          dismissed: [...SEED_ONBOARDING.dismissed, ...(seenIds ?? ['layout'])],
          welcomed: SEED_ONBOARDING.welcomed,
        })
      }
      if (welcomeOnly) {
        expect(stored.settings).toEqual(SEED)
        expect(stored.layout).toBeUndefined()
        expect(stored.onboarding).toEqual({ dismissed: SEED_ONBOARDING.dismissed, welcomed: true })
      }
      // `dismissed` only gains ids.
      if (!fromNoRecord) {
        expect((stored.onboarding as Onboarding).dismissed).toEqual(
          expect.arrayContaining(SEED_ONBOARDING.dismissed),
        )
      }

      const { fellBack, onboarding, settings } = await asV023(stored)

      expect(fellBack).toBe(false)
      // Photos, font and dim survive: the new ones where the write changed them, else the seed's.
      expect(settings).toMatchObject({
        dim: SEED.dim,
        font: SEED.font,
        photos: SEED.photos,
        ...changes,
      })
      // And v0.2.3 draws everything that was written, with nothing dropped or added.
      expect(settings).toEqual(stored.settings)
      expect(onboarding).toEqual(stored.onboarding)
      const newer = await asV030(stored)
      expect(newer.onboarding).toEqual(stored.onboarding)
    },
  )
})

describe('a drop’s write (W21)', () => {
  it('stores the moved Layout and leaves sync:settings and sync:onboarding byte-equal, readable by v0.2.3', async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
    const before = await storeExampleLayout()
    const clock = before.widgets.find(
      (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
    )
    if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
    const { col, id, row } = clock.placed
    const held = pickUp({ layout: before, readOnly: false }, id, { col: col - 1, row: row - 1 })
    if (!held) throw new Error('the Clock could not be picked up')
    const next = drop(move(held, { col: col - 2, row }), { layout: before, readOnly: false })
    if (!next) throw new Error('the drop was refused')

    await layoutItem.setValue(next)
    const stored = await fakeBrowser.storage.sync.get(null)

    expect(stored.settings).toEqual(SEED)
    expect(stored.onboarding).toEqual(SEED_ONBOARDING)
    const moved = (stored.layout as { widgets: { col: number; id: string; row: number }[] }).widgets
    expect(moved.find((widget) => widget.id === id)).toMatchObject({ col: col - 1, row: row + 1 })
    const { fellBack, settings } = await asV023(stored)
    expect(fellBack).toBe(false)
    expect(settings).toEqual(stored.settings)
  })
})

describe('a resize’s write (W22)', () => {
  it('stores the resized Layout and leaves sync:settings and sync:onboarding byte-equal, readable by v0.2.3', async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
    const before = await storeExampleLayout()
    const clock = before.widgets.find(
      (widget) => widget.kind === 'known' && widget.placed.type === 'clock',
    )
    if (clock?.kind !== 'known') throw new Error('the example Layout has a Clock')
    const { col, h, id, row, w } = clock.placed
    const held = pickUpResize({ layout: before, readOnly: false }, id, {
      col: col - 1 + w,
      row: row - 1 + h,
    })
    if (!held) throw new Error('the Clock’s handle could not be picked up')
    const next = drop(move(held, { col: col - 1 + w + 1, row: row - 1 + h + 1 }), {
      layout: before,
      readOnly: false,
    })
    if (!next) throw new Error('the drop was refused')

    await layoutItem.setValue(next)
    const stored = await fakeBrowser.storage.sync.get(null)

    expect(stored.settings).toEqual(SEED)
    expect(stored.onboarding).toEqual(SEED_ONBOARDING)
    const resized = (
      stored.layout as { widgets: { col: number; h: number; id: string; row: number; w: number }[] }
    ).widgets
    // The size changed and the place did not.
    expect(resized.find((widget) => widget.id === id)).toMatchObject({
      col,
      h: h + 1,
      row,
      w: w + 1,
    })
    const { fellBack, settings } = await asV023(stored)
    expect(fellBack).toBe(false)
    expect(settings).toEqual(stored.settings)
  })
})

describe('a keyboard put-down’s write (W23)', () => {
  it('stores a Widget moved and resized in one pick-up, leaves sync:settings and sync:onboarding byte-equal, readable by v0.2.3', async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
    const before = await storeExampleLayout()
    const { col, h, id, row, w } = clockOf(before)
    const next = putDownFromKeyboard(before, [
      { by: LEFT },
      { by: RIGHT, resize: true },
      { by: DOWN },
      { by: DOWN, resize: true },
    ])

    await layoutItem.setValue(next)
    const stored = await fakeBrowser.storage.sync.get(null)

    expect(stored.settings).toEqual(SEED)
    expect(stored.onboarding).toEqual(SEED_ONBOARDING)
    const placed = (
      stored.layout as { widgets: { col: number; h: number; id: string; row: number; w: number }[] }
    ).widgets
    // Both the place and the size changed, and in one write.
    expect(placed.find((widget) => widget.id === id)).toMatchObject({
      col: col - 1,
      h: h + 1,
      row: row + 1,
      w: w + 1,
    })
    const { fellBack, settings } = await asV023(stored)
    expect(fellBack).toBe(false)
    expect(settings).toEqual(stored.settings)
  })
})

describe('the options popover’s writes', () => {
  it('leave the settings as they were, apart from `v` and `clock.hour12`, and v0.2.3 reads that as the Clock’s setting', async () => {
    await settingsItem.setValue(SEED)
    await storeExampleLayout()
    const afterLayout = await fakeBrowser.storage.sync.get(null)
    expect(afterLayout.settings).toEqual(SEED)

    await changeSettings((s) => ({ ...s, clock: { ...s.clock, hour12: !s.clock.hour12 } }))()
    const stored = await fakeBrowser.storage.sync.get(null)
    const { fellBack, settings } = await asV023(stored)

    expect(changedPaths(SEED, stored.settings)).toEqual(['clock.hour12'])
    expect(fellBack).toBe(false)
    expect(settings.clock.hour12).toBe(!SEED.clock.hour12)
    expect(settings.clock).toEqual({ ...SEED.clock, hour12: !SEED.clock.hour12 })
    // And the Layout is there, for the devices that read it.
    expect(stored.layout).toHaveProperty('v', 1)
  })
})

describe('the settings panel, now it has no Clock or Weather options (W17)', () => {
  /** A device whose Clock is off and whose Weather is set up: what v0.2.3 would show, frozen. */
  const CUSTOM: Settings = {
    ...SEED,
    clock: { enabled: false, hour12: false, showDate: true, showSeconds: true },
    weather: {
      ...DEFAULT_SETTINGS.weather,
      enabled: true,
      fields: DEFAULT_SETTINGS.weather.fields.map((field) => ({
        ...field,
        shown: field.id !== 'sun',
      })),
      followDevice: false,
      place: VICTORIA,
      unit: 'fahrenheit',
    },
  }

  it.each([
    ['Dim the photo', (s: Settings) => ({ ...s, dim: !s.dim })],
    ['Font', (s: Settings) => ({ ...s, font: 'instrument-serif' as const })],
    [
      'Change photo',
      (s: Settings) => ({
        ...s,
        photos: { ...s.photos, frequency: '6h' as const, mode: 'cycle' as const },
      }),
    ],
    ['a pinned photo', (s: Settings) => ({ ...s, photos: { ...s.photos, pinnedId: 'p2' } })],
  ])('%s leaves the Clock’s and the Weather’s blocks as they were stored', async (_, change) => {
    await settingsItem.setValue(CUSTOM)
    const background = { colour: '#123456', favouritesOnly: true, future: 1, kind: 'colour', v: 1 }
    const favourites = { future: 2, ids: ['kept-photo'], v: 1 }
    await fakeBrowser.storage.sync.set({ background, favourites })
    await changeSettings(change)()
    const stored = await fakeBrowser.storage.sync.get(null)

    const { fellBack, settings } = await asV023(stored)

    // Not one key of `clock` or `weather` has been written: `enabled`, `showDate`, `showSeconds`
    // and the whole Weather block are exactly what was there.
    expect(JSON.stringify((stored.settings as Settings).clock)).toBe(JSON.stringify(CUSTOM.clock))
    expect(JSON.stringify((stored.settings as Settings).weather)).toBe(
      JSON.stringify(CUSTOM.weather),
    )
    expect(
      changedPaths(CUSTOM, stored.settings).filter((path) => /^clock\.|^weather\./.test(path)),
    ).toEqual([])
    expect(fellBack).toBe(false)
    expect(settings.clock).toEqual(CUSTOM.clock)
    expect(settings.weather).toEqual(CUSTOM.weather)
    expect(stored.background).toEqual(background)
    expect(stored.favourites).toEqual(favourites)
  })

  it('keeps a top-level key it does not know through a panel save, and v0.2.3 still reads it', async () => {
    // Something a later version added next to the blocks, that this one does not recognise.
    await fakeBrowser.storage.sync.set({ settings: { ...CUSTOM, future: { a: 1 } } })
    await changeSettings((s) => ({ ...s, font: 'instrument-serif' }))()
    const stored = await fakeBrowser.storage.sync.get(null)

    const { fellBack, settings } = await asV023(stored)

    expect(stored.settings).toMatchObject({ font: 'instrument-serif', future: { a: 1 } })
    expect(fellBack).toBe(false)
    expect(settings.clock).toEqual(CUSTOM.clock)
    expect(settings.weather).toEqual(CUSTOM.weather)
    expect(settings).toMatchObject({ future: { a: 1 } })
  })
})

describe('sync:layout, which v0.2.3 never reads', () => {
  const v023Settings = { ...SETTINGS_0_2_3, v: 1 }

  it('does not change what v0.2.3 draws, however the Layout is stored', async () => {
    const without = await asV023({ settings: v023Settings })

    for (const layout of [
      exampleLayout(),
      { v: 2, whatever: ['a', 'newer', 'shape'], widgets: [] },
      'not even an object',
      { v: 1 },
    ]) {
      const withLayout = await asV023({ layout, settings: v023Settings })

      expect(withLayout.fellBack).toBe(false)
      expect(withLayout.settings).toEqual(without.settings)
      expect(withLayout.onboarding).toEqual(without.onboarding)
    }
  })

  it('is left exactly as it is by a save of v0.2.3’s own', async () => {
    const layout = JSON.parse(EXAMPLE_LAYOUT_JSON) as unknown

    const after = await saveLikeV023({ layout, settings: v023Settings }, { font: 'system' })

    expect(JSON.stringify(after.raw.layout)).toBe(EXAMPLE_LAYOUT_JSON)
    expect(after.settings).toEqual({ ...v023Settings, font: 'system' })
    expect(after.fellBack).toBe(false)
  })

  it('is left alone when v0.2.3 resets to the defaults, as it would for settings it cannot read', async () => {
    const layout = { v: 2, widgets: [] }
    const unreadable = { ...v023Settings, weather: { ...SETTINGS_0_2_3.weather, unit: 'kelvin' } }

    const after = await saveLikeV023({ layout, settings: unreadable }, { dim: false })

    expect(after.raw.layout).toEqual(layout)
  })
})

describe('background and favourites, which v0.2.3 never reads', () => {
  const background = { colour: '#123456', favouritesOnly: true, kind: 'colour', v: 1 }
  const favourites = { ids: ['pinned-for-later'], v: 1 }
  const rawSync = {
    background,
    favourites,
    settings: { ...SETTINGS_0_2_3, v: 1 },
  }
  const v023Photos = SETTINGS_0_2_3.photos as Settings['photos']

  it.each([
    ['change photo tags', { photos: { ...v023Photos, tags: ['forest'] } }],
    ['change photo frequency', { photos: { ...v023Photos, frequency: '6h' as const } }],
  ])('leaves both new items alone when v0.2.3 saves to %s', async (_, change) => {
    const after = await saveLikeV023(rawSync, change)

    expect(after.raw.background).toEqual(background)
    expect(after.raw.favourites).toEqual(favourites)
    expect(after.settings.photos).toEqual(change.photos)
  })
})
