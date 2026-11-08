import { describe, expect, it } from 'vitest'

import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'
import { makePlace } from '@/test/fixtures'
import type { DevicePosition } from '@/weather/deviceLocation'
import { defaultOptions } from '@/widgetSystem/options'

import { weatherDefinition } from './definition'
import { weatherReadingsInUse } from './readingsInUse'

const VICTORIA = makePlace()
const VANCOUVER = makePlace({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })
const HERE: DevicePosition = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

/** What a Weather stores: the defaults, over which the test puts what it is about. */
const weather = (id: string, col: number, options: Record<string, unknown> = {}) => ({
  col,
  h: 2,
  id,
  options: { ...defaultOptions(weatherDefinition), ...options },
  row: 1,
  type: 'weather',
  w: 2,
})

const clock = (id: string, col: number) => ({
  col,
  h: 2,
  id,
  options: { showDate: true, showSeconds: false },
  row: 4,
  type: 'clock',
  w: 4,
})

/** A Layout as the page reads it, from what would be stored. */
const layoutOf = (widgets: unknown[], more: Record<string, unknown> = {}): Layout =>
  checkLayout({ v: 1, widgets, ...more })

describe('weatherReadingsInUse', () => {
  it('is the key of the place each Weather shows, in its unit', () => {
    const layout = layoutOf([
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
      weather('weather1', 3, { place: VANCOUVER, unit: 'fahrenheit' }),
    ])

    expect(weatherReadingsInUse(layout, null)).toEqual([
      '48.43,-123.37,celsius',
      '49.28,-123.12,fahrenheit',
    ])
  })

  it('names a key once, however many Weathers share it', () => {
    const layout = layoutOf([
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
      weather('weather1', 3, { place: VICTORIA, unit: 'celsius' }),
    ])

    expect(weatherReadingsInUse(layout, null)).toEqual(['48.43,-123.37,celsius'])
  })

  it('keeps one place in two units as two keys', () => {
    const layout = layoutOf([
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
      weather('weather1', 3, { place: VICTORIA, unit: 'fahrenheit' }),
    ])

    expect(weatherReadingsInUse(layout, null)).toEqual([
      '48.43,-123.37,celsius',
      '48.43,-123.37,fahrenheit',
    ])
  })

  it('is no key at all for a Layout with no Weather, and so every reading goes', () => {
    expect(weatherReadingsInUse(layoutOf([clock('clock000', 5)]), null)).toEqual([])
    expect(weatherReadingsInUse(layoutOf([]), null)).toEqual([])
  })

  it('is no key for a Weather with no place picked, which asks for nothing', () => {
    const layout = layoutOf([weather('weather0', 1, { followDevice: false, place: null })])

    expect(weatherReadingsInUse(layout, null)).toEqual([])
  })

  it('is the device’s key, in the Weather’s unit, for a Weather that follows the device', () => {
    const layout = layoutOf([weather('weather0', 1, { followDevice: true, unit: 'fahrenheit' })])

    expect(weatherReadingsInUse(layout, HERE)).toEqual(['48.43,-123.37,fahrenheit'])
  })

  it('does not count the place picked while the Weather follows the device', () => {
    const layout = layoutOf([
      weather('weather0', 1, { followDevice: true, place: VANCOUVER, unit: 'celsius' }),
    ])

    expect(weatherReadingsInUse(layout, HERE)).toEqual(['48.43,-123.37,celsius'])
  })

  it('is unsure while a Weather follows the device and its position is not known', () => {
    const layout = layoutOf([
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
      weather('weather1', 3, { followDevice: true }),
    ])

    expect(weatherReadingsInUse(layout, null)).toBeNull()
  })

  it('counts a Weather the Grid has no room for, which is still in the Layout', () => {
    // Twelve by eight cells, all taken by a Clock: the Weather has no free place.
    const layout = layoutOf([
      { ...clock('clock000', 1), h: 8, w: 12 },
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
    ])

    expect(weatherReadingsInUse(layout, null)).toEqual(['48.43,-123.37,celsius'])
  })

  it('does not count options kept waiting for the first Weather added', () => {
    const layout = layoutOf([clock('clock000', 5)], {
      waiting: { weather: { ...defaultOptions(weatherDefinition), place: VICTORIA } },
    })

    expect(weatherReadingsInUse(layout, null)).toEqual([])
  })

  it('reads a Weather’s options as it draws them, so options that fail the check count as none', () => {
    // The place is not one, so the Weather is drawn from the defaults: no place, nothing to ask.
    const layout = layoutOf([weather('weather0', 1, { place: 'Victoria', unit: 'celsius' })])

    expect(weatherReadingsInUse(layout, null)).toEqual([])
  })

  it('leaves Widgets of other types, and ones it cannot place, out of it', () => {
    const layout = layoutOf([
      weather('weather0', 1, { place: VICTORIA, unit: 'celsius' }),
      { ...weather('later000', 3, { place: VANCOUVER, unit: 'celsius' }), type: 'forecast' },
      { ...weather('weather2', 5, { place: VANCOUVER, unit: 'celsius' }), id: undefined },
    ])

    expect(weatherReadingsInUse(layout, null)).toEqual(['48.43,-123.37,celsius'])
  })
})
