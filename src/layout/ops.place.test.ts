import { describe, expect, it } from 'vitest'

import { checkLayout } from './check'
import { drawnRects } from './geometry'
import { placeWidget } from './ops'
import type { Layout } from './types'

// The Clock is 3 by 2 to 8 by 4 cells, and the Weather 2 by 2 to 4 by 3 (their definitions).
const clock = (id: string, col: number, row: number, w = 4, h = 2) => ({
  col,
  h,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w,
})

const weather = (id: string, col: number, row: number, w = 2, h = 2) => ({
  col,
  h,
  id,
  options: {},
  row,
  type: 'weather',
  w,
})

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })
const editable = (layout: Layout, readOnly = false) => ({ layout, readOnly })

const placeOf = (layout: Layout, id: string) => {
  const widget = layout.widgets.find((w) => w.kind !== 'malformed' && w.placed.id === id)
  if (!widget || widget.kind === 'malformed') throw new Error(`no ${id}`)
  const { col, h, row, w } = widget.placed
  return { col, h, row, w }
}

describe('placeWidget', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('moves and resizes a Widget in one change, which a keyboard pick-up needs', () => {
    const result = placeWidget(editable(layout), 'clock0001', { col: 3, h: 3, row: 2, w: 6 })
    if (!result.ok) throw new Error(`refused: ${result.reason}`)
    expect(placeOf(result.layout, 'clock0001')).toEqual({ col: 3, h: 3, row: 2, w: 6 })
    // Nothing else changes, and the Layout it was given is untouched.
    expect(placeOf(result.layout, 'wthr0001')).toEqual({ col: 11, h: 2, row: 1, w: 2 })
    expect(placeOf(layout, 'clock0001')).toEqual({ col: 5, h: 2, row: 4, w: 4 })
  })

  it('allows a place that a move and then a resize could not reach one step at a time', () => {
    // The Clock gets narrower and moves beside the Weather in one go: its old size at the new
    // column would overlap the Weather, its new size does not.
    const beside = layoutOf(clock('clock0001', 5, 1, 6), weather('wthr0001', 11, 1))
    const result = placeWidget(editable(beside), 'clock0001', { col: 8, h: 2, row: 1, w: 3 })
    expect(result.ok).toBe(true)
  })

  it('refuses a place over another Widget', () => {
    const result = placeWidget(editable(layout), 'clock0001', { col: 9, h: 2, row: 1, w: 4 })
    expect(result).toEqual({ ok: false, reason: 'overlap' })
  })

  it('refuses a place that is not wholly on the Grid', () => {
    const result = placeWidget(editable(layout), 'clock0001', { col: 10, h: 2, row: 4, w: 4 })
    expect(result).toEqual({ ok: false, reason: 'outside' })
  })

  it('refuses a size under its smallest or over its largest', () => {
    expect(placeWidget(editable(layout), 'clock0001', { col: 5, h: 2, row: 4, w: 2 })).toEqual({
      ok: false,
      reason: 'too small',
    })
    expect(placeWidget(editable(layout), 'clock0001', { col: 1, h: 2, row: 4, w: 9 })).toEqual({
      ok: false,
      reason: 'too large',
    })
  })

  it('refuses where the Layout may not be changed, and for an id it does not have', () => {
    expect(
      placeWidget(editable(layout, true), 'clock0001', { col: 1, h: 2, row: 1, w: 4 }),
    ).toEqual({ ok: false, reason: 'read only' })
    expect(placeWidget(editable(layout), 'nothing1', { col: 1, h: 2, row: 1, w: 4 })).toEqual({
      ok: false,
      reason: 'not found',
    })
  })

  it('moves a Widget of a type this version does not know, but gives it no new size', () => {
    const future = layoutOf({ ...clock('futr0001', 5, 4), type: 'future-widget' })
    const moved = placeWidget(editable(future), 'futr0001', { col: 2, h: 2, row: 2, w: 4 })
    expect(moved.ok).toBe(true)
    const resized = placeWidget(editable(future), 'futr0001', { col: 5, h: 3, row: 4, w: 4 })
    expect(resized).toEqual({ ok: false, reason: 'unknown type' })
  })

  it('gives back the very Layout it was given where nothing changes', () => {
    const result = placeWidget(editable(layout), 'clock0001', { col: 5, h: 2, row: 4, w: 4 })
    expect(result.ok && result.layout === layout).toBe(true)
  })

  it('keeps a stored size outside its limits while it is only moved', () => {
    const big = layoutOf(clock('clock0001', 1, 1, 12, 8))
    const result = placeWidget(editable(big), 'clock0001', { col: 1, h: 8, row: 1, w: 12 })
    expect(result.ok).toBe(true)
  })

  it('refuses a height under the smallest while the width is fine, and one over the largest', () => {
    // The Clock is 3 by 2 to 8 by 4 and the Weather 2 by 2 to 4 by 3.
    expect(placeWidget(editable(layout), 'clock0001', { col: 5, h: 1, row: 4, w: 4 })).toEqual({
      ok: false,
      reason: 'too small',
    })
    expect(placeWidget(editable(layout), 'wthr0001', { col: 11, h: 1, row: 1, w: 2 })).toEqual({
      ok: false,
      reason: 'too small',
    })
    expect(placeWidget(editable(layout), 'clock0001', { col: 5, h: 5, row: 1, w: 4 })).toEqual({
      ok: false,
      reason: 'too large',
    })
    expect(placeWidget(editable(layout), 'wthr0001', { col: 11, h: 4, row: 1, w: 2 })).toEqual({
      ok: false,
      reason: 'too large',
    })
  })

  it('allows the largest and the smallest height exactly', () => {
    expect(placeWidget(editable(layout), 'clock0001', { col: 5, h: 4, row: 1, w: 4 }).ok).toBe(true)
    expect(placeWidget(editable(layout), 'clock0001', { col: 5, h: 2, row: 4, w: 3 }).ok).toBe(true)
  })
})

describe('placeWidget, where a Widget is drawn away from where it is stored', () => {
  // The Weather is stored on the Clock's cells, so it is drawn in the free place nearest the
  // middle instead; the Clock, first in reading order, keeps them.
  const crowded = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 5, 4))
  const drawnAt = (layout: Layout, id: string) => {
    const found = drawnRects(layout).find(({ widget }) => widget.placed.id === id)
    if (!found) throw new Error(`${id} is not drawn`)
    return found.rect
  }

  it('stores the Widget where it is drawn when it is put there, which is a change to save', () => {
    const drawn = drawnAt(crowded, 'wthr0001')
    expect(drawn).not.toEqual({ col: 5, h: 2, row: 4, w: 2 })

    const result = placeWidget(editable(crowded), 'wthr0001', drawn)

    if (!result.ok) throw new Error(`refused: ${result.reason}`)
    // Not the Layout it was given: what was stored (on the Clock) is corrected to what is drawn.
    expect(result.layout).not.toBe(crowded)
    expect(placeOf(result.layout, 'wthr0001')).toEqual(drawn)
  })

  it('refuses the place it is stored at, which another Widget is drawn on', () => {
    const result = placeWidget(editable(crowded), 'wthr0001', { col: 5, h: 2, row: 4, w: 2 })
    expect(result).toEqual({ ok: false, reason: 'overlap' })
  })

  it('stores every Widget where it is drawn, not only the one placed (the Layout is settled first)', () => {
    const third = layoutOf(
      clock('clock0001', 5, 4),
      weather('wthr0001', 5, 4),
      weather('wthr0002', 1, 1),
    )
    const drawn = drawnAt(third, 'wthr0001')
    const result = placeWidget(editable(third), 'wthr0002', { col: 1, h: 2, row: 3, w: 2 })
    if (!result.ok) throw new Error(`refused: ${result.reason}`)
    expect(placeOf(result.layout, 'wthr0001')).toEqual(drawn)
    expect(placeOf(result.layout, 'wthr0002')).toEqual({ col: 1, h: 2, row: 3, w: 2 })
  })

  it('refuses a Widget that has no place to be drawn at all: there is no room', () => {
    // The Clock fills the Grid, so the Weather stored on it has nowhere to go and is not drawn.
    const full = layoutOf(clock('clock0001', 1, 1, 12, 8), weather('wthr0001', 1, 1))
    expect(drawnRects(full).map(({ widget }) => widget.placed.id)).toEqual(['clock0001'])
    const result = placeWidget(editable(full), 'wthr0001', { col: 1, h: 2, row: 1, w: 2 })
    expect(result).toEqual({ ok: false, reason: 'no room' })
  })
})
