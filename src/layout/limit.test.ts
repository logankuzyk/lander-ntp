import { describe, expect, it } from 'vitest'

import { checkLayout } from './check'
import { canAdd, drawnCount, WIDGET_LIMIT } from './limit'
import { removeWidget } from './ops'
import type { Layout } from './types'

const clock = (id: string, col: number, row: number) => ({
  col,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w: 4,
})

/** `n` Clocks of 4 by 2 on the Grid's cells, three to a row, none touching another. */
const clocks = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    clock(`clock${String(i).padStart(3, '0')}`, 1 + (i % 3) * 4, 1 + Math.floor(i / 3) * 2),
  )

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })

describe('the Widget limit', () => {
  it('is eight (LR-17)', () => {
    expect(WIDGET_LIMIT).toBe(8)
  })

  it('lets a Widget be added up to seven, and not at eight', () => {
    expect(canAdd(layoutOf())).toBe(true)
    expect(canAdd(layoutOf(...clocks(7)))).toBe(true)
    expect(canAdd(layoutOf(...clocks(8)))).toBe(false)
  })

  it('does not stop a stored Layout of nine from loading, and keeps adding off until it is under', () => {
    const nine = layoutOf(...clocks(9))
    expect(nine.widgets).toHaveLength(9)
    expect(canAdd(nine)).toBe(false)
  })

  it('counts a Widget at any size as one', () => {
    const big = { ...clock('clock000', 1, 1), h: 4, w: 8 }
    const rest = clocks(8)
      .slice(1)
      .map((widget, i) => ({ ...widget, col: 9, row: 1 + i }))
    // One huge Clock and six others: seven.
    expect(drawnCount(layoutOf(big, ...rest.slice(0, 6)))).toBe(7)
  })

  it('counts a Widget of a type this version does not know, and one waiting for setup', () => {
    const unknown = {
      col: 1,
      h: 2,
      id: 'unknown0',
      options: {},
      row: 7,
      type: 'future-widget',
      w: 2,
    }
    // A Weather with no place yet: it shows its setup button, and is a Widget like any other.
    const weather = { col: 3, h: 2, id: 'weather0', options: {}, row: 7, type: 'weather', w: 2 }
    const six = layoutOf(...clocks(6), unknown, weather)
    expect(drawnCount(six)).toBe(8)
    expect(canAdd(six)).toBe(false)
    expect(canAdd(layoutOf(...clocks(6), unknown))).toBe(true)
  })

  it('does not count what is kept but never drawn: a malformed Widget has no ×, and nothing to remove it by', () => {
    const malformed = { col: 'x', h: 1, id: 'bad00000', options: {}, row: 1, type: 'clock', w: 1 }
    const layout = layoutOf(malformed, ...clocks(7))
    expect(layout.widgets).toHaveLength(8)
    expect(drawnCount(layout)).toBe(7)
    expect(canAdd(layout)).toBe(true)
  })

  it('does not count a Widget with no free place, which has no frame to remove it from', () => {
    // Eight 4 by 4 Clocks cannot be: the Grid holds six. The seventh and eighth have no place.
    const wide = Array.from({ length: 8 }, (_, i) => ({
      ...clock(`clock${i}000`, 1 + (i % 3) * 4, 1 + Math.floor(i / 3) * 4),
      h: 4,
    }))
    const layout = layoutOf(...wide)
    expect(layout.widgets).toHaveLength(8)
    expect(drawnCount(layout)).toBe(6)
    expect(canAdd(layout)).toBe(true)
  })

  it('is never reached when there is no limit (a later paid tier)', () => {
    expect(canAdd(layoutOf(...clocks(9)), null)).toBe(true)
  })

  it('takes the limit as an argument, so that a different number can be tried', () => {
    expect(canAdd(layoutOf(...clocks(2)), 2)).toBe(false)
    expect(canAdd(layoutOf(...clocks(1)), 2)).toBe(true)
  })
})

describe('the Widget limit, when a removal lets undrawn Widgets be drawn', () => {
  /** A Clock of any size, which the check keeps as stored. */
  const sized = (id: string, col: number, row: number, w: number, h: number) => ({
    ...clock(id, col, row),
    h,
    w,
  })

  // Eight 3 by 4 Clocks take every cell. Two 3 by 2 Clocks stored on top of the first have no free
  // place, so they are kept and not drawn.
  const full = () =>
    layoutOf(
      ...Array.from({ length: 8 }, (_, i) =>
        sized(`clock${i}000`, 1 + (i % 4) * 3, 1 + Math.floor(i / 4) * 4, 3, 4),
      ),
      sized('undrawn1', 1, 1, 3, 2),
      sized('undrawn2', 1, 1, 3, 2),
    )

  it('counts the eight that are drawn and not the two that are not', () => {
    const layout = full()
    expect(layout.widgets).toHaveLength(10)
    expect(drawnCount(layout)).toBe(8)
    expect(canAdd(layout)).toBe(false)
  })

  it('can go up on a removal: both undrawn Widgets take the freed place, and nothing is hidden', () => {
    const removed = removeWidget({ layout: full(), readOnly: false }, 'clock7000')
    if (!removed.ok) throw new Error('refused')

    expect(removed.layout.widgets).toHaveLength(9)
    expect(drawnCount(removed.layout)).toBe(9)
    expect(canAdd(removed.layout)).toBe(false)

    // A second removal brings it to eight, and it takes a third to get under.
    const second = removeWidget({ layout: removed.layout, readOnly: false }, 'clock6000')
    if (!second.ok) throw new Error('refused')
    expect(drawnCount(second.layout)).toBe(8)
    expect(canAdd(second.layout)).toBe(false)
  })
})
