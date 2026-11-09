import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import { smallestSize } from './definition'
import { defaultOptions } from './options'
import { WIDGETS } from './registry'

describe('the sizes the Widgets declare', () => {
  it('start a Clock at 4 by 2, or 6 by 2 with seconds (LR-16)', () => {
    const base = defaultOptions(clockDefinition)

    expect(clockDefinition.sizes.starting({ ...base, showSeconds: false })).toEqual({ h: 2, w: 4 })
    expect(clockDefinition.sizes.starting({ ...base, showSeconds: true })).toEqual({ h: 2, w: 6 })
  })

  it('lets a Weather with no more than one line start and resize to 1 by 1', () => {
    const options = defaultOptions(weatherDefinition)
    const oneShown = {
      ...options,
      fields: options.fields.map((f) => ({ ...f, shown: f.id === 'highLow' })),
    }
    const noneShown = { ...options, fields: options.fields.map((f) => ({ ...f, shown: false })) }

    expect(smallestSize(weatherDefinition.sizes, options)).toEqual({ h: 1, w: 1 })
    expect(smallestSize(weatherDefinition.sizes, oneShown)).toEqual({ h: 1, w: 1 })
    expect(weatherDefinition.sizes.starting(options)).toEqual({ h: 1, w: 1 })
    expect(weatherDefinition.sizes.starting(oneShown)).toEqual({ h: 1, w: 1 })
    expect(smallestSize(weatherDefinition.sizes, noneShown)).toEqual({ h: 1, w: 1 })
    expect(weatherDefinition.sizes.starting(noneShown)).toEqual({ h: 1, w: 1 })
  })

  it('starts with two or more lines in the measured room for them', () => {
    const options = defaultOptions(weatherDefinition)
    const twoShown = {
      ...options,
      fields: options.fields.map((f) => ({ ...f, shown: ['highLow', 'location'].includes(f.id) })),
    }

    expect(smallestSize(weatherDefinition.sizes, twoShown)).toEqual({ h: 2, w: 2 })
    expect(weatherDefinition.sizes.starting(twoShown)).toEqual({ h: 2, w: 2 })
  })

  it('give the Clock the smallest and largest that were measured for it (LR-86)', () => {
    expect(smallestSize(clockDefinition.sizes, defaultOptions(clockDefinition))).toEqual({
      h: 2,
      w: 3,
    })
    expect(clockDefinition.sizes.largest).toEqual({ h: 4, w: 8 })
  })

  it('give the Weather the largest that was measured for it (LR-87): 4 by 3', () => {
    // Measured in Storybook in all four fonts at six window sizes (see the pull request). Its
    // type is as big as fits across and down, and what it draws is almost as wide as it is tall,
    // so at 1440 by 900 and below the three rows decide and a fourth column only adds room
    // around it. On a narrow, tall window the width decides, and the fourth column is what lets
    // it grow. More rows would only make it larger than the window has room for.
    expect(weatherDefinition.sizes.largest).toEqual({ h: 3, w: 4 })
  })
})

describe('every Widget in the registry', () => {
  it.each(WIDGETS.map((definition) => [definition.type, definition] as const))(
    'starts %s between its smallest and largest size, and both fit on the Grid',
    (_type, definition) => {
      const options = defaultOptions(definition)
      const { largest } = definition.sizes
      const smallest = smallestSize(definition.sizes, options)
      const starting = definition.sizes.starting(options)

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
