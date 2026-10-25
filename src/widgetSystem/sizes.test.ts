import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import { defaultOptions } from './options'
import { WIDGETS } from './registry'

describe('the sizes the Widgets declare', () => {
  it('start a Clock at 4 by 2, or 6 by 2 with seconds (LR-16)', () => {
    const base = defaultOptions(clockDefinition)

    expect(clockDefinition.sizes.starting({ ...base, showSeconds: false })).toEqual({ h: 2, w: 4 })
    expect(clockDefinition.sizes.starting({ ...base, showSeconds: true })).toEqual({ h: 2, w: 6 })
  })

  it('start a Weather at 2 by 2 whatever it shows, and let it be no smaller (LR-9, owner answer 1)', () => {
    const options = defaultOptions(weatherDefinition)
    const allShown = { ...options, fields: options.fields.map((f) => ({ ...f, shown: true })) }
    const noneShown = { ...options, fields: options.fields.map((f) => ({ ...f, shown: false })) }

    for (const given of [options, allShown, noneShown]) {
      expect(weatherDefinition.sizes.starting(given)).toEqual({ h: 2, w: 2 })
    }
    expect(weatherDefinition.sizes.smallest).toEqual({ h: 2, w: 2 })
  })

  it("are first guesses for the largest and the Clock's smallest, to be measured", () => {
    expect(clockDefinition.sizes.smallest).toEqual({ h: 2, w: 3 })
    expect(clockDefinition.sizes.largest).toEqual({ h: 4, w: 8 })
    expect(weatherDefinition.sizes.largest).toEqual({ h: 3, w: 4 })
  })
})

describe('every Widget in the registry', () => {
  it.each(WIDGETS.map((definition) => [definition.type, definition] as const))(
    'starts %s between its smallest and largest size, and both fit on the Grid',
    (_type, definition) => {
      const { largest, smallest } = definition.sizes
      const starting = definition.sizes.starting(defaultOptions(definition))

      expect(smallest.w).toBeGreaterThanOrEqual(1)
      expect(smallest.h).toBeGreaterThanOrEqual(1)
      expect(starting.w).toBeGreaterThanOrEqual(smallest.w)
      expect(starting.h).toBeGreaterThanOrEqual(smallest.h)
      expect(starting.w).toBeLessThanOrEqual(largest.w)
      expect(starting.h).toBeLessThanOrEqual(largest.h)
      expect(largest.w).toBeLessThanOrEqual(12)
      expect(largest.h).toBeLessThanOrEqual(8)
    },
  )
})
