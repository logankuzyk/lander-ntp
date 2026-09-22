import { describe, expect, it } from 'vitest'
import { storage } from 'wxt/utils/storage'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

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
      photos: { mode: 'cycle', frequency: 'every-visit', tags: [], pinnedId: null },
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
    expect(settingsItem.key).toBe('sync:settings')
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a change', async () => {
    const photos = { ...DEFAULT_SETTINGS.photos, frequency: 'daily' as const }
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, photos })

    expect(await settingsItem.getValue()).toMatchObject({ photos })
  })

  it('replaces settings stored by 0.1.1 with the defaults', async () => {
    await storage.setItem('sync:settings', RELEASE_0_1_1)

    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('replaces settings synced from a device on 0.1.1 with the defaults', async () => {
    const seen: (Settings | null)[] = []
    const unwatch = settingsItem.watch((value) => seen.push(value))

    await storage.setItem('sync:settings', RELEASE_0_1_1)
    unwatch()

    expect(seen).toEqual([DEFAULT_SETTINGS])
  })

  it('keeps a font it does not know, which a newer version may have added', async () => {
    const settings = { ...DEFAULT_SETTINGS, font: 'from-the-future' } as unknown as Settings
    await settingsItem.setValue(settings)

    expect(await settingsItem.getValue()).toEqual(settings)
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
