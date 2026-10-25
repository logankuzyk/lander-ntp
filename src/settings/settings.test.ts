import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { storage } from 'wxt/utils/storage'

import { NewerVersionError } from '@/storage/guard'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

/** Settings as 0.1.1 stored them, under this same key: a flat frequency and favourite sites. */
const RELEASE_0_1_1 = {
  clock: { enabled: false, hour12: true, showDate: true, showSeconds: false },
  dim: false,
  favourites: { enabled: true, size: 'm', style: 'list' },
  font: 'geist',
  frequency: 'daily',
}

describe('DEFAULT_SETTINGS', () => {
  it('starts cycling all photos every tab, with the clock and system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      clock: { enabled: true, showDate: false, showSeconds: false },
      dim: true,
      font: 'system',
      photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
      weather: { enabled: false, place: null },
    })
    expect(typeof DEFAULT_SETTINGS.clock.hour12).toBe('boolean')
    expect(FONTS[DEFAULT_SETTINGS.font]).toBeDefined()
  })
})

describe('settingsItem', () => {
  it('syncs settings and falls back to the defaults', async () => {
    expect(settingsItem.key).toBe('sync:settings')
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a change', async () => {
    const photos = { ...DEFAULT_SETTINGS.photos, frequency: 'daily' as const }
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, photos })

    expect(await settingsItem.getValue()).toMatchObject({ photos })
  })

  it('replaces settings stored by 0.1.1 with the defaults', async () => {
    await storage.setItem(settingsItem.key, RELEASE_0_1_1)
    await storage.setMeta(settingsItem.key, { v: 4 })

    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('replaces settings synced from a device on 0.1.1 with the defaults', async () => {
    const seen: (Settings | null)[] = []
    const unwatch = settingsItem.watch((value) => seen.push(value))

    await storage.setItem(settingsItem.key, RELEASE_0_1_1)
    unwatch()

    expect(seen).toEqual([DEFAULT_SETTINGS])
  })

  it('keeps a font it does not know, which a newer version may have added', async () => {
    const settings = { ...DEFAULT_SETTINGS, font: 'from-the-future' } as unknown as Settings
    await settingsItem.setValue(settings)

    expect(await settingsItem.getValue()).toEqual(settings)
  })

  it('keeps weather settings with a place', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      weather: {
        ...DEFAULT_SETTINGS.weather,
        enabled: true,
        place: { latitude: 48.44, longitude: -123.35, name: 'Victoria' },
      },
    }
    await settingsItem.setValue(settings)

    expect(await settingsItem.getValue()).toEqual(settings)
  })

  it('replaces weather fields that are not each listed once with the defaults', async () => {
    const [first, ...rest] = DEFAULT_SETTINGS.weather.fields
    for (const fields of [rest, [first, first, ...rest.slice(1)]]) {
      await storage.setItem(settingsItem.key, {
        ...DEFAULT_SETTINGS,
        dim: false,
        weather: { ...DEFAULT_SETTINGS.weather, fields },
      })

      expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('keeps settings from before the weather widget, with the weather defaults', async () => {
    const { weather, ...before } = { ...DEFAULT_SETTINGS, dim: false, font: 'geist' }
    await storage.setItem(settingsItem.key, before)

    expect(await settingsItem.getValue()).toEqual({ ...before, weather })
  })

  it('replaces settings in a shape it does not know with the defaults', async () => {
    await storage.setItem(settingsItem.key, { photos: 'everything' })

    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })
})

/** Settings as v0.2.3 stored them: the current shape, with no `v`. */
const WITHOUT_VERSION = Object.fromEntries(
  Object.entries({ ...DEFAULT_SETTINGS, dim: false, font: 'geist' }).filter(([key]) => key !== 'v'),
)

/** What is in the sync area under `settings`, as the browser holds it. */
const storedSettings = async () => (await fakeBrowser.storage.sync.get('settings')).settings

describe('settingsItem, versions', () => {
  afterEach(() => vi.restoreAllMocks())

  it('starts at version 1', () => {
    expect(DEFAULT_SETTINGS.v).toBe(1)
  })

  it('reads settings with no `v`, as v0.2.3 wrote them, as version 1, without writing anything', async () => {
    await fakeBrowser.storage.sync.set({ settings: WITHOUT_VERSION })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    expect(await settingsItem.read()).toEqual({
      newer: false,
      value: { ...WITHOUT_VERSION, v: 1 },
    })
    expect(set).not.toHaveBeenCalled()
    expect(await storedSettings()).toEqual(WITHOUT_VERSION)
  })

  it('adds `v: 1` on the first save after an update, and keeps the rest', async () => {
    await fakeBrowser.storage.sync.set({ settings: WITHOUT_VERSION })

    const current = await settingsItem.getValue()
    await settingsItem.setValue({ ...current, font: 'system' })

    expect(await storedSettings()).toEqual({ ...WITHOUT_VERSION, font: 'system', v: 1 })
  })

  it('keeps a top-level key it does not know through a read and a save', async () => {
    await fakeBrowser.storage.sync.set({
      settings: { ...WITHOUT_VERSION, bookmarks: { open: 'tab' }, v: 1 },
    })

    const current = await settingsItem.getValue()
    await settingsItem.setValue({ ...current, dim: true })

    expect(await storedSettings()).toEqual({
      ...WITHOUT_VERSION,
      bookmarks: { open: 'tab' },
      dim: true,
      v: 1,
    })
  })

  it('reads settings of a higher version as newer, drawn as they are stored', async () => {
    await fakeBrowser.storage.sync.set({ settings: { ...WITHOUT_VERSION, v: 2 } })

    const { newer, value } = await settingsItem.read()

    expect(newer).toBe(true)
    expect(value).toMatchObject({ dim: false, font: 'geist' })
  })

  it('draws the defaults for a newer version whose shape the check does not know', async () => {
    await fakeBrowser.storage.sync.set({ settings: { grid: [], v: 2 } })

    expect(await settingsItem.read()).toEqual({ newer: true, value: DEFAULT_SETTINGS })
  })

  it('treats a `v` it cannot read as newer', async () => {
    await fakeBrowser.storage.sync.set({ settings: { ...WITHOUT_VERSION, v: 'two' } })

    expect((await settingsItem.read()).newer).toBe(true)
  })

  it('never saves over a newer version, and leaves it as it is', async () => {
    const newer = { ...WITHOUT_VERSION, bookmarks: [], v: 2 }
    await fakeBrowser.storage.sync.set({ settings: newer })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    await expect(settingsItem.setValue(DEFAULT_SETTINGS)).rejects.toBeInstanceOf(NewerVersionError)

    expect(set).not.toHaveBeenCalled()
    expect(await storedSettings()).toEqual(newer)
  })

  it('does not save over a newer version that arrived after the settings were read', async () => {
    await fakeBrowser.storage.sync.set({ settings: WITHOUT_VERSION })
    const current = await settingsItem.getValue()

    await fakeBrowser.storage.sync.set({ settings: { ...WITHOUT_VERSION, v: 2 } })
    await expect(settingsItem.setValue({ ...current, dim: true })).rejects.toBeInstanceOf(
      NewerVersionError,
    )

    expect(await storedSettings()).toEqual({ ...WITHOUT_VERSION, v: 2 })
  })

  it('tells a watcher when a newer version arrives', async () => {
    const seen: [Settings | null, boolean | undefined][] = []
    const unwatch = settingsItem.watch((value, newer) => seen.push([value, newer]))

    await storage.setItem(settingsItem.key, { ...WITHOUT_VERSION, v: 2 })
    unwatch()

    expect(seen).toEqual([[expect.objectContaining({ font: 'geist' }), true]])
  })
})

describe('fontStack', () => {
  it('returns the stack for a known font', () => {
    expect(fontStack('geist')).toBe(FONTS.geist.stack)
  })

  it('falls back to the system stack for an id it does not know', () => {
    // Settings sync between devices, which can be on different versions of the extension.
    expect(fontStack('fraunces')).toBe(FONTS.system.stack)
  })
})
