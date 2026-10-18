import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'

import { pageValues, widgetsFromSettings } from './fromSettings'

const withClock = (clock: Partial<Settings['clock']>): Settings => ({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, ...clock },
})

describe('widgetsFromSettings', () => {
  it('gives one Clock with its options when the clock is on', () => {
    const settings = withClock({ enabled: true, showDate: true, showSeconds: false })
    expect(widgetsFromSettings(settings)).toEqual([
      { options: { showDate: true, showSeconds: false }, type: 'clock' },
    ])
  })

  it('gives no Clock when the clock is off', () => {
    expect(widgetsFromSettings(withClock({ enabled: false }))).toEqual([])
  })

  it('leaves 12/24-hour time out of the Clock, and the Weather out for now', () => {
    const settings: Settings = {
      ...withClock({ hour12: true }),
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true },
    }
    expect(widgetsFromSettings(settings)).toEqual([
      { options: { showDate: false, showSeconds: false }, type: 'clock' },
    ])
  })
})

describe('pageValues', () => {
  it('takes 12/24-hour time from the clock settings', () => {
    expect(pageValues(withClock({ hour12: true }))).toEqual({ hour12: true })
    expect(pageValues(withClock({ hour12: false }))).toEqual({ hour12: false })
  })
})
