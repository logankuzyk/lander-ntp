import { describe, expect, it } from 'vitest'

import { formatTime } from './time'

describe('formatTime', () => {
  const evening = new Date(2026, 8, 11, 21, 5)
  const morning = new Date(2026, 8, 11, 9, 5)

  it('formats 24-hour time by default', () => {
    expect(formatTime(evening, { locale: 'en-CA' })).toBe('21:05')
  })

  it('formats 12-hour time without a day period', () => {
    expect(formatTime(evening, { hour12: true, locale: 'en-CA' })).toBe('9:05')
  })

  it('zero-pads 24-hour times before 10', () => {
    expect(formatTime(morning, { locale: 'en-CA' })).toBe('09:05')
  })

  it('does not zero-pad 12-hour times before 10', () => {
    expect(formatTime(morning, { hour12: true, locale: 'en-CA' })).toBe('9:05')
  })
})
