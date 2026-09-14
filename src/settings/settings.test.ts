import { describe, expect, it } from 'vitest'

import { FONTS, fontStack } from './fonts'
import { DEFAULT_SETTINGS, type Settings } from './schema'
import { settingsItem } from './storage'

describe('DEFAULT_SETTINGS', () => {
  it('starts on a new photo every tab, with the clock on, favourites on and the system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      frequency: 'every-visit',
      clock: { enabled: true, showDate: false, showSeconds: false },
      font: 'system',
      dim: true,
      favourites: { enabled: true, style: 'list', size: 'm' },
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

  it('switches the photo wash on for installs that predate it', async () => {
    const beforeDim: Record<string, unknown> = { ...DEFAULT_SETTINGS }
    delete beforeDim.dim
    await settingsItem.setValue(beforeDim as unknown as Settings)
    await settingsItem.setMeta({ v: 2 })

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ dim: true })
  })

  it('leaves a stored photo wash choice alone', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, dim: false })
    await settingsItem.setMeta({ v: 3 })

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toMatchObject({ dim: false })
  })

  it('drops the widget switches an older install still has stored', async () => {
    const withWidgets = { ...DEFAULT_SETTINGS, widgets: { credit: false, info: false } }
    await settingsItem.setValue(withWidgets as unknown as Settings)
    await settingsItem.setMeta({ v: 3 })

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).not.toHaveProperty('widgets')
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
