import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { checkLayout } from './check'
import {
  clampSize,
  collides,
  COLS,
  drawnRects,
  fitNew,
  isOnGrid,
  nearestFreeToMiddle,
  type Rect,
  ROWS,
} from './geometry'
import type { PlacedWidget } from './types'

const rect = (col: number, row: number, w: number, h: number): Rect => ({ col, h, row, w })

describe('the Grid', () => {
  it('is 12 columns by 8 rows', () => {
    expect([COLS, ROWS]).toEqual([12, 8])
  })

  it.each([
    ['fills the Grid', rect(1, 1, 12, 8), true],
    ['sits in the last cell', rect(12, 8, 1, 1), true],
    ['starts left of column 1', rect(0, 1, 2, 2), false],
    ['starts above row 1', rect(1, 0, 2, 2), false],
    ['starts right of column 12', rect(13, 1, 1, 1), false],
    ['runs one column past the right edge', rect(9, 1, 5, 1), false],
    ['runs one row past the bottom edge', rect(1, 7, 1, 3), false],
    ['is wider than the Grid', rect(1, 1, 13, 1), false],
    ['has no width', rect(3, 3, 0, 2), false],
    ['has no height', rect(3, 3, 2, 0), false],
    ['starts between two cells', rect(1.5, 1, 2, 2), false],
  ])('says a place that %s is on the Grid: %s', (_name, place, expected) => {
    expect(isOnGrid(place)).toBe(expected)
  })
})

describe('collides', () => {
  const a = rect(5, 4, 4, 2)

  it.each([
    ['the same place', rect(5, 4, 4, 2), true],
    ['one shared cell at a corner', rect(8, 5, 3, 3), true],
    ['one inside the other', rect(6, 4, 1, 1), true],
    ['a wider one across it', rect(1, 4, 12, 1), true],
    ['a taller one across it', rect(6, 1, 1, 8), true],
    ['one that touches along the right edge', rect(9, 4, 2, 2), false],
    ['one that touches along the left edge', rect(3, 4, 2, 2), false],
    ['one that touches along the bottom edge', rect(5, 6, 4, 2), false],
    ['one that touches along the top edge', rect(5, 2, 4, 2), false],
    ['one that touches at a corner only', rect(9, 6, 2, 2), false],
    ['one far away', rect(11, 1, 2, 1), false],
  ])('says %s: %s', (_name, other, expected) => {
    expect(collides(a, other)).toBe(expected)
    expect(collides(other, a)).toBe(expected)
  })
})

describe('nearestFreeToMiddle', () => {
  it.each([
    ['a 4 by 2 Clock', { h: 2, w: 4 }, rect(5, 4, 4, 2)],
    ['a 6 by 2 Clock', { h: 2, w: 6 }, rect(4, 4, 6, 2)],
    ['a 2 by 2 Weather', { h: 2, w: 2 }, rect(6, 4, 2, 2)],
    ['the whole Grid', { h: 8, w: 12 }, rect(1, 1, 12, 8)],
  ])('puts %s exactly in the middle of an empty Grid', (_name, size, expected) => {
    expect(nearestFreeToMiddle(size, [])).toEqual(expected)
  })

  it('can centre a Widget only when its width is even and its height is even', () => {
    // The middle of the Grid is the corner between columns 6 and 7 and between rows 4 and 5.
    const centred = (place: Rect) => place.col + place.w / 2 === 7 && place.row + place.h / 2 === 5
    for (let w = 1; w <= COLS; w++) {
      for (let h = 1; h <= ROWS; h++) {
        const place = nearestFreeToMiddle({ h, w }, [])
        expect(place).not.toBeNull()
        expect(centred(place as Rect), `${w} by ${h}`).toBe(w % 2 === 0 && h % 2 === 0)
      }
    }
  })

  it('breaks a tie by taking the first place row by row, left to right', () => {
    // 3 wide: columns 5 to 7 and 6 to 8 are equally far from the middle.
    expect(nearestFreeToMiddle({ h: 2, w: 3 }, [])).toEqual(rect(5, 4, 3, 2))
    // 1 high: rows 4 and 5 are equally far.
    expect(nearestFreeToMiddle({ h: 1, w: 4 }, [])).toEqual(rect(5, 4, 4, 1))
    // One cell: columns 6 and 7, rows 4 and 5.
    expect(nearestFreeToMiddle({ h: 1, w: 1 }, [])).toEqual(rect(6, 4, 1, 1))
  })

  it('takes the free place nearest the middle when the middle is taken', () => {
    const clock = rect(5, 4, 4, 2)
    // Above (rows 2 and 3) and below (rows 6 and 7) the Clock are equally near: the upper wins.
    expect(nearestFreeToMiddle({ h: 2, w: 2 }, [clock])).toEqual(rect(6, 2, 2, 2))
    // With that taken too, the place below is next.
    expect(nearestFreeToMiddle({ h: 2, w: 2 }, [clock, rect(6, 2, 2, 2)])).toEqual(rect(6, 6, 2, 2))
  })

  it('never takes a cell that is taken, and touching is not taking', () => {
    const taken = [rect(4, 3, 2, 2), rect(7, 3, 2, 2), rect(4, 6, 5, 1)]
    const place = nearestFreeToMiddle({ h: 2, w: 3 }, taken)
    expect(place).not.toBeNull()
    for (const other of taken) expect(collides(place as Rect, other)).toBe(false)
    expect(isOnGrid(place as Rect)).toBe(true)
  })

  it('finds nothing when there is no room, or the size cannot fit on the Grid at all', () => {
    expect(nearestFreeToMiddle({ h: 1, w: 1 }, [rect(1, 1, 12, 8)])).toBeNull()
    expect(nearestFreeToMiddle({ h: 2, w: 3 }, [rect(1, 1, 12, 4), rect(1, 5, 12, 3)])).toBeNull()
    expect(nearestFreeToMiddle({ h: 1, w: 13 }, [])).toBeNull()
    expect(nearestFreeToMiddle({ h: 9, w: 1 }, [])).toBeNull()
  })
})

describe('placing by LR-16', () => {
  const clockOptions = defaultOptions(clockDefinition)
  const weatherOptions = defaultOptions(weatherDefinition)

  it('puts the Clock at the exact centre: columns 5 to 8, or 4 to 9 with seconds, from row 4', () => {
    expect(fitNew(clockDefinition, clockOptions, [])).toEqual(rect(5, 4, 4, 2))
    expect(fitNew(clockDefinition, { ...clockOptions, showSeconds: true }, [])).toEqual(
      rect(4, 4, 6, 2),
    )
  })

  it('has the update paths fit: a Weather in columns 11 and 12 touches neither Clock', () => {
    const clocks = [rect(5, 4, 4, 2), rect(4, 4, 6, 2)]
    const weathers = [rect(11, 1, 2, 1), rect(11, 1, 2, 2)]
    for (const place of [...clocks, ...weathers]) expect(isOnGrid(place)).toBe(true)
    for (const clock of clocks) {
      for (const weather of weathers) expect(collides(clock, weather)).toBe(false)
    }
  })

  it('puts a Weather added to the default page in the free place nearest the middle', () => {
    expect(fitNew(weatherDefinition, weatherOptions, [rect(5, 4, 4, 2)])).toEqual(rect(6, 2, 2, 2))
  })
})

describe('fitNew', () => {
  const options = defaultOptions(clockDefinition)

  it('tries the starting size first, even where a smaller one would sit nearer the middle', () => {
    // The 3 wide place in columns 5 to 7 is nearer the middle, but 4 wide fits in columns 4 to 7.
    expect(fitNew(clockDefinition, options, [rect(8, 4, 1, 2)])).toEqual(rect(4, 4, 4, 2))
  })

  it('shrinks to fit: the largest smaller size that fits, down to the smallest', () => {
    // Free: columns 5 to 7 of rows 6 to 8 only, 3 wide.
    const taken = [rect(1, 1, 12, 5), rect(1, 6, 4, 3), rect(8, 6, 5, 3)]
    expect(fitNew(clockDefinition, options, taken)).toEqual(rect(5, 6, 3, 2))
    // The same with seconds, which start at 6 by 2: 5 by 2 and 4 by 2 do not fit either.
    expect(fitNew(clockDefinition, { ...options, showSeconds: true }, taken)).toEqual(
      rect(5, 6, 3, 2),
    )
  })

  it('finds nothing when not even the smallest fits', () => {
    // A gap two columns wide: the Clock's smallest is 3 by 2.
    expect(
      fitNew(clockDefinition, options, [rect(1, 1, 12, 5), rect(1, 6, 5, 3), rect(8, 6, 5, 3)]),
    ).toBeNull()
    // The Weather cannot go below 2 by 2: one free row is not enough.
    expect(
      fitNew(weatherDefinition, defaultOptions(weatherDefinition), [rect(1, 1, 12, 7)]),
    ).toBeNull()
  })
})

describe('clampSize', () => {
  it.each([
    ['inside is left alone', { h: 3, w: 5 }, { h: 3, w: 5 }],
    ['the smallest is left alone', { h: 2, w: 3 }, { h: 2, w: 3 }],
    ['the largest is left alone', { h: 4, w: 8 }, { h: 4, w: 8 }],
    ['below both is raised to the smallest', { h: 1, w: 1 }, { h: 2, w: 3 }],
    ['above both is lowered to the largest', { h: 20, w: 20 }, { h: 4, w: 8 }],
    ['is clamped one side at a time', { h: 9, w: 2 }, { h: 4, w: 3 }],
  ])("a Clock's size %s", (_name, size, expected) => {
    expect(clampSize(clockDefinition, size)).toEqual(expected)
  })
})

describe('drawnRects', () => {
  const clock = (id: string, col: number, row: number, extra: Partial<PlacedWidget> = {}) => ({
    col,
    h: 2,
    id,
    options: { showDate: false, showSeconds: false },
    row,
    type: 'clock',
    w: 4,
    ...extra,
  })
  const layoutOf = (...widgets: unknown[]) => checkLayout({ v: 1, widgets })
  const placesOf = (layout: ReturnType<typeof layoutOf>) =>
    Object.fromEntries(
      drawnRects(layout).map(({ rect: place, widget }) => [widget.placed.id, place]),
    )

  it('draws each Widget where it is stored when that is on the Grid and free', () => {
    const layout = layoutOf(clock('a', 5, 4), clock('b', 1, 1))

    expect(placesOf(layout)).toEqual({ a: rect(5, 4, 4, 2), b: rect(1, 1, 4, 2) })
  })

  it('draws a Widget off the Grid in the free place of its size nearest the middle', () => {
    const layout = layoutOf(clock('a', 10, 4), clock('b', 5, 4))

    // "a" runs two columns past the edge; "b" holds the middle.
    expect(placesOf(layout)).toEqual({ a: rect(5, 2, 4, 2), b: rect(5, 4, 4, 2) })
  })

  it('leaves the stored place alone', () => {
    const layout = layoutOf(clock('a', 10, 4))
    const before = JSON.stringify(layout)

    expect(placesOf(layout)).toEqual({ a: rect(5, 4, 4, 2) })
    expect(JSON.stringify(layout)).toBe(before)
    expect(layout.widgets[0]).toMatchObject({ placed: { col: 10, row: 4 } })
  })

  it('draws one of two overlapping Widgets where it is and moves the other', () => {
    // Reading order (row, then column) decides: "a" is first, so "b" moves.
    const layout = layoutOf(clock('b', 6, 4), clock('a', 5, 4))

    const places = placesOf(layout)
    expect(places.a).toEqual(rect(5, 4, 4, 2))
    expect(places.b).not.toEqual(rect(6, 4, 4, 2))
    expect(collides(places.a as Rect, places.b as Rect)).toBe(false)
    expect(isOnGrid(places.b as Rect)).toBe(true)
  })

  it('gives the same result whatever order the Widgets are stored in', () => {
    const widgets = [clock('a', 5, 4), clock('b', 6, 4), clock('c', 7, 4), clock('d', 20, 20)]
    const forward = placesOf(layoutOf(...widgets))
    const backward = placesOf(layoutOf(...[...widgets].reverse()))

    expect(backward).toEqual(forward)
  })

  it('never moves a Widget that is fine to make room for one that is not', () => {
    // "a" is off the Grid and would like the middle; "b" is on it.
    const layout = layoutOf(clock('a', 12, 1), clock('b', 5, 4))

    expect(placesOf(layout).b).toEqual(rect(5, 4, 4, 2))
  })

  it('leaves a Widget undrawn when there is no free place for it', () => {
    const layout = layoutOf(clock('all', 1, 1, { h: 8, w: 12 }), {
      ...clock('b', 3, 3),
      h: 2,
      options: {},
      type: 'weather',
      w: 2,
    })

    expect(placesOf(layout)).toEqual({ all: rect(1, 1, 12, 8) })
    // It is still in the Layout.
    expect(layout.widgets).toHaveLength(2)
  })

  it('holds the cells of a Widget this version does not know, and draws it', () => {
    // Both want the same place, and "f" comes first in reading order.
    const future = { col: 5, h: 2, id: 'f', options: { x: 1 }, row: 4, type: 'bookmarks', w: 4 }
    const layout = layoutOf(future, clock('g', 5, 4))

    const drawn = drawnRects(layout)
    expect(drawn.map((entry) => entry.widget.kind)).toEqual(['unknown', 'known'])
    expect(placesOf(layout).f).toEqual(rect(5, 4, 4, 2))
    expect(collides(placesOf(layout).g as Rect, rect(5, 4, 4, 2))).toBe(false)
  })

  it('does not draw a Widget that is not well-formed, and it holds no cells', () => {
    const layout = layoutOf(
      { col: 5, h: 2, id: 'bad', options: {}, row: 4, type: 'clock', w: 'wide' },
      clock('a', 5, 4),
    )

    expect(placesOf(layout)).toEqual({ a: rect(5, 4, 4, 2) })
  })

  it('gives nothing for an empty Layout', () => {
    expect(drawnRects(layoutOf())).toEqual([])
  })

  it('lists them in the stored order', () => {
    const layout = layoutOf(clock('z', 1, 1), clock('m', 5, 4), clock('a', 9, 7))

    expect(drawnRects(layout).map(({ widget }) => widget.placed.id)).toEqual(['z', 'm', 'a'])
  })
})
