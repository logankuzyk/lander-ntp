import { describe, expect, it } from 'vitest'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

/** Settings as v4 stored them, before the photo settings were grouped. */
const V4 = {
  frequency: 'every-visit',
  clock: DEFAULT_SETTINGS.clock,
  font: 'system',
  dim: true,
  favourites: { enabled: true, style: 'list', size: 'm' },
}

/** Store settings from an older version, so migrate() has something to do. */
const storeOld = async (settings: Record<string, unknown>, version: number) => {
  await settingsItem.setValue(settings as unknown as Settings)
  // setValue stamps the current version, so rewind it to make the migration run.
  await settingsItem.setMeta({ v: version })
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
    expect(settingsItem.key).toBe('sync:settings')
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips a change', async () => {
    const photos = { ...DEFAULT_SETTINGS.photos, frequency: 'daily' as const }
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, photos })

    expect(await settingsItem.getValue()).toMatchObject({ photos })
  })

  it('moves a v1 font choice onto the typeface that replaced it', async () => {
    await storeOld({ ...V4, font: 'fraunces' }, 1)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ font: 'instrument-serif' })
  })

  it('switches the photo wash on for installs that predate it', async () => {
    const beforeDim: Record<string, unknown> = { ...V4 }
    delete beforeDim.dim
    await storeOld(beforeDim, 2)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ dim: true })
  })

  it('leaves a stored photo wash choice alone', async () => {
    await storeOld({ ...V4, dim: false }, 3)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ dim: false })
  })

  it('drops the widget switches an older install still has stored', async () => {
    await storeOld({ ...V4, widgets: { credit: false, info: false } }, 3)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).not.toHaveProperty('widgets')
  })

  it('groups the photo settings, keeping the frequency and dropping favourites', async () => {
    await storeOld({ ...V4, frequency: 'daily' }, 4)

    await settingsItem.migrate()

    const migrated = await settingsItem.getValue()
    expect(migrated.photos).toEqual({
      mode: 'cycle',
      frequency: 'daily',
      tag: null,
      pinnedId: null,
    })
    expect(migrated).not.toHaveProperty('frequency')
    expect(migrated).not.toHaveProperty('favourites')
  })

  it('turns a frequency of never into keeping the photo on screen', async () => {
    await storeOld({ ...V4, frequency: 'off' }, 4)

    await settingsItem.migrate()

    expect((await settingsItem.getValue()).photos).toEqual({
      mode: 'pinned',
      frequency: 'every-visit',
      tag: null,
      pinnedId: null,
    })
  })

  it('leaves the rest of the settings alone while migrating', async () => {
    await storeOld({ ...V4, frequency: 'daily' }, 1)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toEqual({
      photos: { mode: 'cycle', frequency: 'daily', tag: null, pinnedId: null },
      clock: V4.clock,
      font: 'system',
      dim: true,
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
