import { describe, expect, it } from 'vitest'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

describe('DEFAULT_SETTINGS', () => {
  it('starts on a new photo every tab, with the clock on, favourites off and the system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      frequency: 'every-visit',
      clock: { enabled: true, showDate: false, showSeconds: false },
      font: 'system',
      favourites: { enabled: false, style: 'list', size: 'm' },
      widgets: { credit: true, info: true },
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
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, frequency: 'daily' })

    expect(await settingsItem.getValue()).toMatchObject({ frequency: 'daily' })
  })

  it('moves a v1 font choice onto the typeface that replaced it', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, font: 'fraunces' } as unknown as Settings)
    // setValue stamps the current version, so rewind it to make the migration run.
    await settingsItem.setMeta({ v: 1 })

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ font: 'instrument-serif' })
  })

  it('leaves the rest of the settings alone while migrating', async () => {
    const stored: Settings = { ...DEFAULT_SETTINGS, frequency: 'daily', font: 'system' }
    await settingsItem.setValue(stored)
    await settingsItem.setMeta({ v: 1 })

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toEqual(stored)
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
