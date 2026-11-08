import { describe, expect, it } from 'vitest'

import { defaultOptions, readOptions } from '@/widgetSystem/options'

import { dateDefinition } from './definition'

describe('Date definition', () => {
  it('starts within its smallest and largest sizes and exposes all five options', () => {
    const options = defaultOptions(dateDefinition)
    const { h, w } = dateDefinition.sizes.starting(options)
    expect(w).toBeGreaterThanOrEqual(dateDefinition.sizes.smallest.w)
    expect(h).toBeGreaterThanOrEqual(dateDefinition.sizes.smallest.h)
    expect(w).toBeLessThanOrEqual(dateDefinition.sizes.largest.w)
    expect(h).toBeLessThanOrEqual(dateDefinition.sizes.largest.h)
    expect(dateDefinition.options.map(({ id }) => id)).toEqual([
      'format',
      'showYear',
      'monthGrid',
      'weekStartsOn',
      'weekNumbers',
    ])
  })

  it('draws defaults for invalid stored options without changing the stored bytes', () => {
    const stored = { format: 'unexpected', retained: { v: 2 }, showYear: 'yes' }
    const before = JSON.stringify(stored)
    expect(readOptions(dateDefinition, stored)).toMatchObject({
      format: 'short',
      monthGrid: true,
      retained: { v: 2 },
      showYear: false,
      weekNumbers: false,
    })
    expect(JSON.stringify(stored)).toBe(before)
  })
})
