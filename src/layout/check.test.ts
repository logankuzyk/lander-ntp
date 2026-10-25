import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { checkLayout, isLayoutReadable, storedLayout } from './check'
import {
  EXAMPLE_LAYOUT_JSON,
  exampleLayout,
  knownAt,
  storedAt,
  syncBytes,
  widgetAt,
} from './fixtures'
import type { PlacedWidget } from './types'

const clock = (id: string, extra: Partial<PlacedWidget> = {}): PlacedWidget => ({
  col: 1,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false },
  row: 1,
  type: 'clock',
  w: 4,
  ...extra,
})

describe('checkLayout', () => {
  it('matches each Widget to its definition and keeps its options as drawn', () => {
    const layout = checkLayout(exampleLayout())

    expect(layout.widgets).toHaveLength(2)
    expect(widgetAt(layout, 0)).toMatchObject({
      definition: clockDefinition,
      kind: 'known',
      options: { showDate: false, showSeconds: false },
    })
    expect(widgetAt(layout, 1)).toMatchObject({ definition: weatherDefinition, kind: 'known' })
    expect(layout.widgets.map((widget) => widget.kind === 'known' && widget.placed.id)).toEqual([
      'k3f9x2ma',
      'p8d1q7zt',
    ])
  })

  it('is stored byte for byte as it was read, for the example in LR-15', () => {
    const stored = storedLayout(checkLayout(JSON.parse(EXAMPLE_LAYOUT_JSON)))

    expect(JSON.stringify(stored)).toBe(EXAMPLE_LAYOUT_JSON)
    // 480 of 8,192 bytes, counted as the browsers count them.
    expect(syncBytes('layout', stored)).toBe(480)
  })

  it('stamps `v: 1` on what it stores', () => {
    expect(storedLayout(checkLayout({ widgets: [] })).v).toBe(1)
    // Also on a Layout a newer version wrote: nothing is saved over that one, but what is
    // drawn is never taken for another version's.
    expect(storedLayout(checkLayout({ v: 2, widgets: [] })).v).toBe(1)
  })

  it('keeps a top-level key it does not know, and stores it back', () => {
    const raw = { ...exampleLayout(), snapTo: 'grid' }

    const layout = checkLayout(raw)

    expect(layout.extra).toEqual({ snapTo: 'grid' })
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('keeps an option key it does not know, drawn and stored', () => {
    const raw = exampleLayout()
    const first = storedAt(raw, 0)
    first.options = { ...first.options, hands: 'analog' }

    const layout = checkLayout(raw)

    expect(knownAt(layout, 0).options).toEqual({
      hands: 'analog',
      showDate: false,
      showSeconds: false,
    })
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('keeps a key it does not know on a Widget, and stores it back', () => {
    const raw = exampleLayout()
    ;(storedAt(raw, 0) as Record<string, unknown>).locked = true

    expect(storedLayout(checkLayout(raw))).toEqual(raw)
  })

  it('keeps a Widget of a type it does not know, marked unknown, and stores it back', () => {
    const raw = exampleLayout()
    raw.widgets.push({
      col: 1,
      h: 2,
      id: 'zz9y8x7w',
      options: { feeds: ['news'], limit: 5 },
      row: 7,
      type: 'bookmarks',
      w: 3,
    })

    const layout = checkLayout(raw)

    expect(widgetAt(layout, 2)).toEqual({ kind: 'unknown', placed: storedAt(raw, 2) })
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('draws options that fail their Widget’s check as its defaults, and leaves the stored ones as they are', () => {
    const raw = exampleLayout()
    const stored = storedAt(raw, 1)
    stored.options = { ...stored.options, unit: 'kelvin' }

    const layout = checkLayout(raw)
    const weather = knownAt(layout, 1)

    expect(weather.options).toEqual(defaultOptions(weatherDefinition))
    expect(weather.placed.options.unit).toBe('kelvin')
    expect(JSON.stringify(storedLayout(layout))).toBe(JSON.stringify(raw))
  })

  it('loads nine Widgets whole: the limit is not part of the check', () => {
    const raw = {
      v: 1,
      widgets: Array.from({ length: 9 }, (_, i) => clock(`id00000${i}`, { row: i + 1 })),
    }

    const layout = checkLayout(raw)

    expect(layout.widgets).toHaveLength(9)
    expect(layout.widgets.every((widget) => widget.kind === 'known')).toBe(true)
  })

  it.each([
    ['a place that is not a whole number', { col: 1.5 }],
    ['a place that is not a number', { row: '4' }],
    ['a width of nothing', { w: 0 }],
    ['a negative height', { h: -2 }],
    ['no id', { id: undefined }],
    ['an empty id', { id: '' }],
    ['an id that is not text', { id: 7 }],
    ['a type that is not text', { type: null }],
    ['options that are not an object', { options: 'none' }],
    ['no options', { options: undefined }],
  ])('keeps a Widget with %s as it was, not drawn', (_, change) => {
    const bad = { ...clock('badbad01'), ...change }
    const raw = { v: 1, widgets: [clock('goodgd01'), bad] }

    const layout = checkLayout(raw)

    expect(widgetAt(layout, 0).kind).toBe('known')
    expect(widgetAt(layout, 1)).toEqual({ kind: 'malformed', raw: bad })
    expect(storedAt(storedLayout(layout), 1)).toBe(bad)
  })

  it('keeps an entry that is not an object as it was', () => {
    const raw = { v: 1, widgets: [clock('goodgd01'), null, 'clock', 4] }

    const layout = checkLayout(raw)

    expect(layout.widgets.map((widget) => widget.kind)).toEqual([
      'known',
      'malformed',
      'malformed',
      'malformed',
    ])
    expect(storedLayout(layout).widgets).toEqual(raw.widgets)
  })

  it('draws the first of two Widgets with one id and keeps the other as it was, not drawn', () => {
    const raw = { v: 1, widgets: [clock('same0001'), clock('same0001', { row: 5 })] }

    const layout = checkLayout(raw)

    expect(layout.widgets.map((widget) => widget.kind)).toEqual(['known', 'malformed'])
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('keeps a place off the Grid as it is stored: drawing it elsewhere is not the check’s job', () => {
    const raw = { v: 1, widgets: [clock('offgrid1', { col: 30, row: 20 })] }

    const layout = checkLayout(raw)

    expect(widgetAt(layout, 0).kind).toBe('known')
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('keeps waiting options as they are, with a key it does not know', () => {
    const raw = {
      v: 1,
      waiting: {
        bookmarks: { limit: 3 },
        clock: { showDate: true, showSeconds: false },
      },
      widgets: [],
    }

    const layout = checkLayout(raw)

    expect(layout.waiting).toEqual(raw.waiting)
    expect(storedLayout(layout)).toEqual(raw)
  })

  it('stores no `waiting` key when there are none', () => {
    expect(storedLayout(checkLayout({ v: 1, widgets: [] }))).toEqual({ v: 1, widgets: [] })
  })

  it('is empty for a value it can make nothing of', () => {
    expect(checkLayout('layout')).toEqual({ extra: {}, widgets: [] })
  })
})

describe('isLayoutReadable', () => {
  it.each([
    ['an example', exampleLayout()],
    ['no Widgets', { v: 1, widgets: [] }],
    ['no `v`', { widgets: [] }],
    ['a Layout of a newer version, in the shape it knows', { v: 2, widgets: [] }],
    ['waiting options', { v: 1, waiting: {}, widgets: [] }],
  ])('is true for %s', (_, raw) => {
    expect(isLayoutReadable(raw)).toBe(true)
  })

  it.each([
    ['text', 'layout'],
    ['a number', 7],
    ['a list', []],
    ['an object with no Widgets', { v: 1 }],
    ['Widgets that are not a list', { v: 1, widgets: { clock: {} } }],
    ['waiting options that are not an object', { v: 1, waiting: 'clock', widgets: [] }],
    ['waiting options that are a list', { v: 1, waiting: [], widgets: [] }],
  ])('is false for %s', (_, raw) => {
    expect(isLayoutReadable(raw)).toBe(false)
  })
})

describe('the size of a stored Layout', () => {
  const weather = (id: string, row: number): PlacedWidget => ({
    col: 11,
    h: 1,
    id,
    options: {
      fields: [
        { id: 'highLow', shown: true },
        { id: 'location', shown: true },
        { id: 'sun', shown: true },
        { id: 'condition', shown: true },
        { id: 'feelsLike', shown: true },
      ],
      followDevice: false,
      place: { latitude: 48.4284, longitude: -123.3656, name: 'a'.repeat(31) },
      unit: 'fahrenheit',
    },
    row,
    type: 'weather',
    w: 2,
  })

  it('is far under 8,192 bytes in LR-15’s worst case: 8 Weathers with long names and both kinds of waiting options', () => {
    const waiting = {
      clock: { showDate: true, showSeconds: true },
      weather: weather('x', 1).options as never,
    }
    const stored = storedLayout(
      checkLayout({
        v: 1,
        waiting,
        widgets: Array.from({ length: 8 }, (_, i) => weather(`wthr000${i}`, i + 1)),
      }),
    )

    const bytes = syncBytes('layout', stored)

    expect(bytes).toBeLessThan(8192)
    expect(bytes).toBeGreaterThan(3000)
  })
})
