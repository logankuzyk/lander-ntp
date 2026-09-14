import { describe, expect, it } from 'vitest'

import { FONTS } from './fonts'
import { DEFAULT_SETTINGS } from './schema'
import { settingsItem } from './storage'

describe('DEFAULT_SETTINGS', () => {
  it('starts on a new photo every tab, with the clock on and the system font', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      frequency: 'every-visit',
      clock: { enabled: true, showDate: false, showSeconds: false },
      font: 'system',
      favourites: { enabled: true, style: 'list', size: 'm' },
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

  it('migrates without losing settings, ready for later schema changes', async () => {
    const stored = { ...DEFAULT_SETTINGS, font: 'fraunces' as const }
    await settingsItem.setValue(stored)

    await settingsItem.migrate()

    expect(await settingsItem.getValue()).toEqual(stored)
  })
})
