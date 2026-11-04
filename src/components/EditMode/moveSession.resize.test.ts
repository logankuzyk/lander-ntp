import { describe, expect, it } from 'vitest'

import { checkLayout, storedLayout } from '@/layout/check'
import { COLS, drawnRects, ROWS } from '@/layout/geometry'
import type { Layout } from '@/layout/types'

import { drop, move, pickUp, pickUpResize, type ResizeSession } from './moveSession'

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

/** What a Layout is stored as, as JSON, so two can be compared whole. */
const stored = (layout: Layout) => JSON.parse(JSON.stringify(storedLayout(layout))) as unknown

/**
 * The session of a pick-up of the handle that must succeed. By default the pointer is on the
 * Widget's bottom right corner itself, so that where the pointer is, is where the corner is.
 */
function held(layout: Layout, id: string, at?: { col: number; row: number }): ResizeSession {
  const rect = drawnRects(layout).find(({ widget }) => widget.placed.id === id)?.rect
  const start =
    at ?? (rect ? { col: rect.col - 1 + rect.w, row: rect.row - 1 + rect.h } : undefined)
  const session = start && pickUpResize(editable(layout), id, start)
  if (!session) throw new Error(`could not pick up the handle of ${id}`)
  return session
}

/** The pointer at the Widget's bottom right corner plus `dx` and `dy` cells. */
const corner = (session: ResizeSession, dx: number, dy: number) => ({
  col: session.origin.col - 1 + session.origin.w + dx,
  row: session.origin.row - 1 + session.origin.h + dy,
})

describe('resizeSession, picking up the handle', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('holds the Widget as it is drawn, at the size it has, in a place that is allowed', () => {
    const session = held(layout, 'clock0001')
    expect(session.kind).toBe('resize')
    expect(session.origin).toEqual({ col: 5, h: 2, row: 4, w: 4 })
    expect(session.place).toEqual(session.origin)
    expect(session.size).toEqual({ h: 2, w: 4 })
    expect(session.valid).toBe(true)
  })

  it('knows the other Widgets, which it may not take cells of', () => {
    expect(held(layout, 'clock0001').others).toEqual([{ col: 11, h: 2, row: 1, w: 2 }])
  })

  it('picks up nothing for an id the Layout does not have', () => {
    expect(pickUpResize(editable(layout), 'nothing1', { col: 8, row: 6 })).toBeNull()
  })

  it('picks up nothing from a Layout that may not be changed', () => {
    expect(pickUpResize(editable(layout, true), 'clock0001', { col: 8, row: 6 })).toBeNull()
  })

  it('picks up nothing that is kept but not well-formed, which has no place', () => {
    const bad = layoutOf(clock('clock0001', 5, 4), { id: 'junk0001', type: 'clock' })
    expect(pickUpResize(editable(bad), 'junk0001', { col: 1, row: 1 })).toBeNull()
  })

  it('picks up nothing of a Widget of a type this version does not know: it has no sizes', () => {
    const unknown = layoutOf({ ...clock('futr0001', 5, 4), type: 'bookmarks' })
    expect(pickUp(editable(unknown), 'futr0001', { col: 5.5, row: 4.5 })).not.toBeNull()
    expect(pickUpResize(editable(unknown), 'futr0001', { col: 8, row: 6 })).toBeNull()
  })

  it('holds a Widget that is drawn away from where it is stored at the place it is drawn', () => {
    const crowded = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 5, 4))
    const drawn = drawnRects(crowded).find(({ widget }) => widget.placed.id === 'wthr0001')
    expect(held(crowded, 'wthr0001').origin).toEqual(drawn?.rect)
  })
})

describe('resizeSession, resizing', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('does not jump when it is picked up away from the corner: the grab is kept', () => {
    // The handle is a little inside the corner: 0.15 of a cell in and 0.1 up.
    const session = held(layout, 'clock0001', { col: 8.85, row: 5.9 })
    const still = move(session, { col: 8.85, row: 5.9 })
    expect(still.place).toEqual(session.origin)
    expect(still.size.w).toBeCloseTo(4)
    expect(still.size.h).toBeCloseTo(2)
    // 2 columns and a row across and down from where it was grabbed is 2 and 1 more cells.
    const grown = move(session, { col: 8.85 + 2, row: 5.9 + 1 })
    expect(grown.place).toEqual({ col: 5, h: 3, row: 4, w: 6 })
    expect(grown.size.w).toBeCloseTo(6)
    expect(grown.size.h).toBeCloseTo(3)
  })

  it('keeps the top left corner where it is and changes only the size', () => {
    const session = held(layout, 'clock0001')
    const grown = move(session, corner(session, 2, 1))
    expect(grown.place).toEqual({ col: 5, h: 3, row: 4, w: 6 })
    expect(grown.valid).toBe(true)
    const shrunk = move(session, corner(session, -1, 0))
    expect(shrunk.place).toEqual({ col: 5, h: 2, row: 4, w: 3 })
    expect(shrunk.valid).toBe(true)
  })

  it('snaps to the nearest whole cell, each side on its own', () => {
    const session = held(layout, 'clock0001')
    const at = (dx: number, dy: number) => move(session, corner(session, dx, dy)).place
    expect(at(0.4, 0).w).toBe(4)
    expect(at(0.6, 0).w).toBe(5)
    expect(at(-0.4, 0).w).toBe(4)
    expect(at(-0.6, 0).w).toBe(3)
    expect(at(0, 0.49).h).toBe(2)
    expect(at(0, 0.51).h).toBe(3)
    expect(at(0, 1.6).h).toBe(4)
    expect(at(0.6, 0.49)).toMatchObject({ h: 2, w: 5 })
  })

  it('follows the pointer exactly in `size`, between the smallest and largest', () => {
    const session = held(layout, 'clock0001')
    const moved = move(session, corner(session, 1.3, 0.4))
    expect(moved.size.w).toBeCloseTo(5.3)
    expect(moved.size.h).toBeCloseTo(2.4)
    expect(moved.place).toMatchObject({ h: 2, w: 5 })
  })

  it('stops at the largest size, however far the pointer goes', () => {
    // Column 2 to 12 and rows 2 to 8 are free to it, so only the Clock's 8 by 4 stops it.
    const roomy = layoutOf(clock('clock0001', 2, 2))
    const session = held(roomy, 'clock0001')
    const far = move(session, corner(session, 40, 40))
    expect(far.place).toEqual({ col: 2, h: 4, row: 2, w: 8 })
    expect(far.size).toEqual({ h: 4, w: 8 })
    expect(far.valid).toBe(true)
    // Just under it, and at it: not past.
    expect(move(session, corner(session, 3.4, 1.4)).place).toMatchObject({ h: 3, w: 7 })
    expect(move(session, corner(session, 3.6, 1.6)).place).toMatchObject({ h: 4, w: 8 })
    expect(move(session, corner(session, 4.4, 2.4)).place).toMatchObject({ h: 4, w: 8 })
  })

  it('stops at the smallest size, however far back the pointer goes, even past the top left', () => {
    const session = held(layout, 'clock0001')
    const far = move(session, corner(session, -40, -40))
    expect(far.place).toEqual({ col: 5, h: 2, row: 4, w: 3 })
    expect(far.size).toEqual({ h: 2, w: 3 })
    expect(far.valid).toBe(true)
    expect(move(session, corner(session, -0.6, -0.6)).place).toMatchObject({ h: 2, w: 3 })
    expect(move(session, corner(session, -1.4, 0)).place).toMatchObject({ w: 3 })
    expect(move(session, corner(session, -1.6, 0)).place).toMatchObject({ w: 3 })
  })

  it('clamps each side on its own: the width at its limit and the height free', () => {
    const roomy = layoutOf(clock('clock0001', 2, 2))
    const session = held(roomy, 'clock0001')
    expect(move(session, corner(session, 40, 1)).place).toMatchObject({ h: 3, w: 8 })
    expect(move(session, corner(session, -40, 1)).place).toMatchObject({ h: 3, w: 3 })
  })

  it('stops at the edge of the Grid when that is nearer than the largest size', () => {
    // From column 9 there are four columns, from row 7 two rows; the Clock could be 8 by 4.
    const edge = layoutOf(clock('clock0001', 9, 7, 3, 2))
    const session = held(edge, 'clock0001')
    const far = move(session, corner(session, 40, 40))
    expect(far.place).toEqual({ col: 9, h: ROWS - 7 + 1, row: 7, w: COLS - 9 + 1 })
    expect(far.valid).toBe(true)
    expect(far.size).toEqual({ h: 2, w: 4 })
  })

  it('cannot grow a Widget that already fills the room between it and the Grid edge', () => {
    // The Weather at the top right is 2 wide, and there are no more columns.
    const session = held(layout, 'wthr0001')
    const far = move(session, corner(session, 40, 0.2))
    expect(far.place).toEqual({ col: 11, h: 2, row: 1, w: 2 })
    expect(far.valid).toBe(true)
  })

  it('refuses a size that takes another Widget’s cells, and says what size it would have been', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    const session = held(beside, 'clock0001')
    // Columns 3 to 8 would take the Weather’s first column.
    const over = move(session, corner(session, 2, 0))
    expect(over.place).toEqual({ col: 3, h: 2, row: 4, w: 6 })
    expect(over.valid).toBe(false)
    // And below: a taller Clock reaches into a Widget under it.
    const under = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 3, 6))
    const down = held(under, 'clock0001')
    expect(move(down, corner(down, 0, 1)).valid).toBe(false)
  })

  it('allows a size that only touches another Widget', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    const session = held(beside, 'clock0001')
    const touching = move(session, corner(session, 1, 0))
    expect(touching.place).toEqual({ col: 3, h: 2, row: 4, w: 5 })
    expect(touching.valid).toBe(true)
  })

  it('is allowed again once the pointer comes back from the other Widget', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    const session = held(beside, 'clock0001')
    const over = move(session, corner(session, 2, 0))
    expect(over.valid).toBe(false)
    expect(move(over, corner(session, 0, 0)).valid).toBe(true)
  })

  it('treats a Widget stored under its smallest as that size until the pointer snaps it', () => {
    // Stored 2 by 1, under the Clock’s smallest of 3 by 2 (a Layout from elsewhere may be).
    const small = layoutOf(clock('clock0001', 5, 4, 2, 1))
    const session = held(small, 'clock0001')
    expect(session.place).toEqual({ col: 5, h: 1, row: 4, w: 2 })
    expect(session.valid).toBe(true)
    // Any move snaps it up to the smallest.
    expect(move(session, corner(session, 0, 0)).place).toMatchObject({ h: 2, w: 3 })
  })

  it('is refused where even the smallest does not fit between the Widget and the Grid edge', () => {
    // Column 12 has room for one column, the Clock needs 3.
    const edge = layoutOf(clock('clock0001', 12, 4, 1, 1))
    const session = held(edge, 'clock0001')
    const stuck = move(session, corner(session, 5, 0))
    expect(stuck.valid).toBe(false)
    // What is drawn stays on the Grid.
    expect(stuck.place.col + stuck.place.w - 1).toBeLessThanOrEqual(COLS)
    expect(drop(stuck, editable(edge))).toBeNull()
  })

  it('does not change the session it was given, or the Layout', () => {
    const before = stored(layout)
    const session = held(layout, 'clock0001')
    const copy = structuredClone({ ...session, definition: undefined })
    move(session, corner(session, 3, 2))
    expect({ ...session, definition: undefined }).toEqual(copy)
    expect(stored(layout)).toEqual(before)
  })
})

describe('resizeSession, dropping', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('gives the next Layout, with the Widget at the size it was held at and nothing else changed', () => {
    const session = held(layout, 'clock0001')
    const next = drop(move(session, corner(session, 2, 1)), editable(layout))
    expect(next).not.toBeNull()
    if (!next) return
    expect(stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 5, 4, 6, 3), weather('wthr0001', 11, 1))),
    )
    // The Layout it started from is as it was.
    expect(stored(layout)).toEqual(
      stored(layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))),
    )
  })

  it('gives the size it was clamped to, not the one the pointer reached', () => {
    const roomy = layoutOf(clock('clock0001', 2, 2))
    const session = held(roomy, 'clock0001')
    const large = drop(move(session, corner(session, 40, 40)), editable(roomy))
    expect(large && stored(large)).toEqual(stored(layoutOf(clock('clock0001', 2, 2, 8, 4))))
    const small = drop(move(session, corner(session, -40, -40)), editable(roomy))
    expect(small && stored(small)).toEqual(stored(layoutOf(clock('clock0001', 2, 2, 3, 2))))
  })

  it('gives one result however many moves came before it', () => {
    const first = held(layout, 'clock0001')
    let session = first
    for (let step = 1; step <= 20; step++) {
      session = move(session, corner(first, (step % 5) - 2, step % 3))
    }
    session = move(session, corner(first, 2, 1))
    const next = drop(session, editable(layout))
    expect(next && stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 5, 4, 6, 3), weather('wthr0001', 11, 1))),
    )
  })

  it('gives nothing where the size is refused, so the Widget goes back', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    const session = held(beside, 'clock0001')
    const over = move(session, corner(session, 2, 0))
    expect(over.valid).toBe(false)
    expect(drop(over, editable(beside))).toBeNull()
  })

  it('gives nothing when the Widget was put down at the size it had', () => {
    const session = held(layout, 'clock0001')
    expect(drop(move(session, corner(session, 0.3, -0.2)), editable(layout))).toBeNull()
    expect(drop(session, editable(layout))).toBeNull()
    // Nor at a limit it is already at.
    const biggest = layoutOf(clock('clock0001', 2, 2, 8, 4))
    const big = held(biggest, 'clock0001')
    expect(drop(move(big, corner(big, 40, 40)), editable(biggest))).toBeNull()
  })

  it('gives nothing for a Widget drawn away from where it is stored, put down at its size', () => {
    // Saving it would write the place it is drawn at, which nobody chose by pressing a handle.
    const crowded = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 5, 4))
    const session = held(crowded, 'wthr0001')
    expect(drop(move(session, corner(session, 0.2, 0.1)), editable(crowded))).toBeNull()
  })

  it('gives the smallest where a Widget stored under it is resized at all', () => {
    const small = layoutOf(clock('clock0001', 5, 4, 2, 1))
    const session = held(small, 'clock0001')
    const next = drop(move(session, corner(session, 0, 0)), editable(small))
    expect(next && stored(next)).toEqual(stored(layoutOf(clock('clock0001', 5, 4, 3, 2))))
  })

  it('gives nothing where the Layout may not be changed', () => {
    const session = held(layout, 'clock0001')
    expect(drop(move(session, corner(session, 2, 1)), editable(layout, true))).toBeNull()
  })

  it('checks the size against the Layout as it is at the drop, not as it was at the pick-up', () => {
    const session = held(layout, 'clock0001')
    const grown = move(session, corner(session, 2, 1))
    // Another tab put a Weather on the cells the Clock has grown over.
    const meanwhile = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 9, 4))
    expect(drop(grown, editable(meanwhile))).toBeNull()
  })

  it('gives nothing if the Widget is gone by the drop', () => {
    const session = held(layout, 'clock0001')
    const grown = move(session, corner(session, 2, 1))
    expect(drop(grown, editable(layoutOf(weather('wthr0001', 11, 1))))).toBeNull()
  })

  it('resizes at the place a Widget is drawn when that is not where it is stored', () => {
    const crowded = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 5, 4))
    const drawn = drawnRects(crowded).find(({ widget }) => widget.placed.id === 'wthr0001')
    const session = held(crowded, 'wthr0001')
    const next = drop(move(session, corner(session, 1, 0)), editable(crowded))
    const after = next?.widgets.find(
      (widget) => widget.kind === 'known' && widget.placed.id === 'wthr0001',
    )
    expect(after?.kind === 'known' && after.placed).toMatchObject({
      col: drawn?.rect.col,
      row: drawn?.rect.row,
      w: 3,
    })
  })

  it('keeps the options of the Widget, and of the others', () => {
    const custom = layoutOf(
      { ...clock('clock0001', 5, 4), options: { colour: 'teal', showDate: true } },
      weather('wthr0001', 11, 1),
    )
    const session = held(custom, 'clock0001')
    const next = drop(move(session, corner(session, 1, 0)), editable(custom))
    expect(next && stored(next)).toEqual(
      stored(
        layoutOf(
          { ...clock('clock0001', 5, 4, 5, 2), options: { colour: 'teal', showDate: true } },
          weather('wthr0001', 11, 1),
        ),
      ),
    )
  })
})
