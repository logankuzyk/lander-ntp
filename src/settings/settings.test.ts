import { describe, expect, it } from 'vitest'
import { storage } from 'wxt/utils/storage'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

/** Settings as 0.1.1 stored them, under this same key: a flat frequency and favourite sites. */
const RELEASE_0_1_1 = {
  frequency: 'daily',
  clock: { enabled: false, hour12: true, showDate: true, showSeconds: false },
  font: 'geist',
  dim: false,
  favourites: { enabled: true, style: 'list', size: 'm' },
}

describe('DEFAULT_SETTINGS', () => {
  it('starts cycling all photos every tab, with the clock and system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      photos: { mode: 'cycle', frequency: 'every-visit', tags: [], pinnedId: null },
      clock: { enabled: true, showDate: false, showSeconds: false },
      weather: { enabled: false, place: null },
      font: 'system',
      dim: true,
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
        place: { name: 'Victoria', latitude: 48.44, longitude: -123.35 },
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
    const { weather, ...before } = { ...DEFAULT_SETTINGS, font: 'geist', dim: false }
    await storage.setItem(settingsItem.key, before)

    expect(await settingsItem.getValue()).toEqual({ ...before, weather })
  })

  it('replaces settings in a shape it does not know with the defaults', async () => {
    await storage.setItem(settingsItem.key, { photos: 'everything' })

    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
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
