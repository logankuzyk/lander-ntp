import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'

import { pageValues } from './fromSettings'

const withClock = (clock: Partial<Settings['clock']>): Settings => ({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, ...clock },
})

describe('pageValues', () => {
  it('takes 12/24-hour time from the clock settings', () => {
    expect(pageValues(withClock({ hour12: true }))).toEqual({ hour12: true })
    expect(pageValues(withClock({ hour12: false }))).toEqual({ hour12: false })
  })
})
