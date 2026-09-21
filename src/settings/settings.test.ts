import { describe, expect, it } from 'vitest'
import { storage } from 'wxt/utils/storage'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { fromLegacySettings, LEGACY_SETTINGS_KEY, settingsItem } from './storage'

/** Settings as 0.1.1 stored them: a flat frequency, and favourite sites. */
const RELEASE_0_1_1 = {
  frequency: 'daily',
  clock: { enabled: false, hour12: true, showDate: true, showSeconds: false },
  font: 'geist',
  dim: false,
  favourites: { enabled: true, style: 'list', size: 'm' },
}

describe('DEFAULT_SETTINGS', () => {
  it('starts cycling all photos every tab, with the clock on and the system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      photos: { mode: 'cycle', frequency: 'every-visit', tag: null, pinnedId: null },
      clock: { enabled: true, showDate: false, showSeconds: false },
      font: 'system',
      dim: true,
    })
    expect(typeof DEFAULT_SETTINGS.clock.hour12).toBe('boolean')
    expect(FONTS[DEFAULT_SETTINGS.font]).toBeDefined()
  })
})

describe('settingsItem', () => {
  it('syncs settings and falls back to the defaults', async () => {
    expect(settingsItem.key).toBe('sync:settings2')
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a change', async () => {
    const photos = { ...DEFAULT_SETTINGS.photos, frequency: 'daily' as const }
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, photos })

    expect(await settingsItem.getValue()).toMatchObject({ photos })
  })

  it('leaves the key 0.1.1 reads alone, so devices still on it keep working', async () => {
    await storage.setItem(LEGACY_SETTINGS_KEY, RELEASE_0_1_1)
    await storage.setMeta(LEGACY_SETTINGS_KEY, { v: 4 })

    await settingsItem.getValue()
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, font: 'geist-mono' })

    expect(await storage.getItem(LEGACY_SETTINGS_KEY)).toEqual(RELEASE_0_1_1)
    expect(await storage.getMeta(LEGACY_SETTINGS_KEY)).toEqual({ v: 4 })
    // Nor does the new key take on the old one's version.
    expect(await storage.getMeta(settingsItem.key)).toEqual({})
  })

  it('carries settings over from 0.1.1 on the first read', async () => {
    await storage.setItem(LEGACY_SETTINGS_KEY, RELEASE_0_1_1)

    const expected: Settings = {
      photos: { ...DEFAULT_SETTINGS.photos, frequency: 'daily' },
      clock: RELEASE_0_1_1.clock,
      font: 'geist',
      dim: false,
    }
    expect(await settingsItem.getValue()).toEqual(expected)
    expect(await storage.getItem(settingsItem.key)).toEqual(expected)
  })

  it('carries them over only once', async () => {
    await storage.setItem(LEGACY_SETTINGS_KEY, RELEASE_0_1_1)
    await settingsItem.getValue()

    // A device still on 0.1.1 changes its settings afterwards.
    await storage.setItem(LEGACY_SETTINGS_KEY, { ...RELEASE_0_1_1, font: 'instrument-serif' })

    expect((await settingsItem.getValue()).font).toBe('geist')
  })

  it('ignores changes synced from a device on 0.1.1', async () => {
    const seen: (Settings | null)[] = []
    const unwatch = settingsItem.watch((value) => seen.push(value))

    await storage.setItem(LEGACY_SETTINGS_KEY, RELEASE_0_1_1)
    unwatch()

    expect(seen).toEqual([])
  })

  it('keeps a font it does not know, which a newer version may have added', async () => {
    const settings = { ...DEFAULT_SETTINGS, font: 'from-the-future' } as unknown as Settings
    await settingsItem.setValue(settings)

    expect(await settingsItem.getValue()).toEqual(settings)
  })

  it('replaces settings in a shape it does not know with the defaults', async () => {
    await storage.setItem(settingsItem.key, { photos: 'everything' })

    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('fromLegacySettings', () => {
  it('pins the photo on screen for a frequency of off', () => {
    expect(fromLegacySettings({ ...RELEASE_0_1_1, frequency: 'off' }).photos).toEqual({
      mode: 'pinned',
      frequency: DEFAULT_SETTINGS.photos.frequency,
      tag: null,
      pinnedId: null,
    })
  })

  it('cycles at the frequency it had', () => {
    expect(fromLegacySettings({ ...RELEASE_0_1_1, frequency: '15m' }).photos).toEqual({
      ...DEFAULT_SETTINGS.photos,
      frequency: '15m',
    })
  })

  it.each([null, undefined, 'settings', 42, [], {}])(
    'falls back to the defaults for %o',
    (value) => {
      expect(fromLegacySettings(value)).toEqual(DEFAULT_SETTINGS)
    },
  )

  it('replaces each malformed or missing setting with its default, keeping the rest', () => {
    expect(
      fromLegacySettings({ frequency: 'hourly', clock: { enabled: false }, font: 7, dim: false }),
    ).toEqual({ ...DEFAULT_SETTINGS, dim: false })
    expect(fromLegacySettings({ clock: RELEASE_0_1_1.clock })).toEqual({
      ...DEFAULT_SETTINGS,
      clock: RELEASE_0_1_1.clock,
    })
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
