import { render } from '@testing-library/preact'
import { h } from 'preact'
import { describe, expect, it, vi } from 'vitest'

import { defaultOptions, readOptions } from '@/widgetSystem/options'

import { analogClockDefinition } from './definition'

describe('the Analog clock definition', () => {
  it('uses its permanent type id and declares its three options', () => {
    expect(analogClockDefinition.type).toBe('analog-clock')
    expect(analogClockDefinition.name).toBe('Analog clock')
    expect(analogClockDefinition.options.map(({ id, label }) => [id, label])).toEqual([
      ['face', 'Face'],
      ['showSeconds', 'Seconds hand'],
      ['showDate', 'Date window'],
    ])
    expect(defaultOptions(analogClockDefinition)).toEqual({
      face: 'minimal',
      showDate: false,
      showSeconds: true,
    })
  })

  it('reads only valid option values, defaulting missing and invalid values', () => {
    expect(readOptions(analogClockDefinition, { face: 'numerals', showDate: true })).toEqual({
      face: 'numerals',
      showDate: true,
      showSeconds: true,
    })
    expect(readOptions(analogClockDefinition, { face: 'roman', showSeconds: 'yes' })).toEqual({
      face: 'minimal',
      showDate: false,
      showSeconds: true,
    })
  })

  it('has no Needs or Source and is a square Widget from 2 by 2 through 6 by 6', () => {
    expect(analogClockDefinition.needs).toBeUndefined()
    expect(analogClockDefinition.source).toBeUndefined()
    expect(analogClockDefinition.sizes).toEqual({
      largest: { h: 6, w: 6 },
      smallest: { h: 2, w: 2 },
      starting: expect.any(Function),
    })
    expect(analogClockDefinition.sizes.starting(defaultOptions(analogClockDefinition))).toEqual({
      h: 2,
      w: 2,
    })
  })

  it('uses the page-wide 12-hour value when labeling the dial', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 21, 5))
    try {
      const { container } = render(
        h(analogClockDefinition.View, {
          cells: { h: 2, w: 2 },
          context: undefined,
          options: defaultOptions(analogClockDefinition),
          page: { hour12: true },
          reading: undefined,
        }),
      )
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Analog clock, 9:05')
    } finally {
      vi.useRealTimers()
    }
  })
})
