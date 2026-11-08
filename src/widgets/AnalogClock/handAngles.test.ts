import { describe, expect, it } from 'vitest'

import { handAngles } from './handAngles'

describe('the Analog clock hand angles', () => {
  it.each([
    [new Date(2026, 0, 1, 0, 0, 0), { hour: 0, minute: 0, second: 0 }],
    [new Date(2026, 0, 1, 3, 15, 30), { hour: 97.75, minute: 93, second: 180 }],
    [new Date(2026, 0, 1, 12, 30, 45), { hour: 15.375, minute: 184.5, second: 270 }],
  ])('positions the hands at %s', (date, expected) => {
    const actual = handAngles(date)
    expect(actual.hour).toBeCloseTo(expected.hour, 10)
    expect(actual.minute).toBeCloseTo(expected.minute, 10)
    expect(actual.second).toBeCloseTo(expected.second, 10)
  })
})
