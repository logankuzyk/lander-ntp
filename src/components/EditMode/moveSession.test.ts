import { describe, expect, it } from 'vitest'

import { checkLayout, storedLayout } from '@/layout/check'
import { COLS, drawnRects, ROWS } from '@/layout/geometry'
import type { Layout } from '@/layout/types'

import { cancel, drop, move, type MoveSession, pickUp, toCells } from './moveSession'

const clock = (id: string, col: number, row: number, w = 4, h = 2) => ({
  col,
  h,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w,
})

const weather = (id: string, col: number, row: number) => ({
  col,
  h: 2,
  id,
  options: {},
  row,
  type: 'weather',
  w: 2,
})

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })
const editable = (layout: Layout, readOnly = false) => ({ layout, readOnly })

/** What a Layout is stored as, as JSON, so two can be compared whole. */
const stored = (layout: Layout) => JSON.parse(JSON.stringify(storedLayout(layout))) as unknown

/**
 * The session of a pick-up that must succeed. By default the pointer is on the Widget's top left
 * corner, so that where the pointer is, is where the Widget's corner is (see `corner`).
 */
function held(layout: Layout, id: string, at?: { col: number; row: number }): MoveSession {
  const rect = drawnRects(layout).find(({ widget }) => widget.placed.id === id)?.rect
  const start = at ?? (rect ? { col: rect.col - 1, row: rect.row - 1 } : { col: 0, row: 0 })
  const session = pickUp(editable(layout), id, start)
  if (!session) throw new Error(`could not pick up ${id}`)
  return session
}

/**
 * The pointer at a Widget's top left cell plus `dx` and `dy` cells: where the pointer is when
 * the Widget was grabbed at its very corner and moved by that much.
 */
const corner = (session: MoveSession, dx: number, dy: number) => ({
  col: session.origin.col - 1 + dx,
  row: session.origin.row - 1 + dy,
})

describe('moveSession, picking up', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('holds the Widget where it is drawn, in a place that is allowed', () => {
    const session = held(layout, 'clock0001', { col: 5.5, row: 4.5 })
    expect(session.kind).toBe('move')
    expect(session.origin).toEqual({ col: 5, h: 2, row: 4, w: 4 })
    expect(session.place).toEqual(session.origin)
    expect(session.valid).toBe(true)
  })

  it('picks up nothing for an id the Layout does not have', () => {
    expect(pickUp(editable(layout), 'nothing1', { col: 1, row: 1 })).toBeNull()
  })

  it('picks up nothing from a Layout that may not be changed', () => {
    expect(pickUp(editable(layout, true), 'clock0001', { col: 5.5, row: 4.5 })).toBeNull()
  })

  it('picks up nothing that is kept but not well-formed, which has no place', () => {
    const bad = layoutOf(clock('clock0001', 5, 4), { id: 'junk0001', type: 'clock' })
    expect(pickUp(editable(bad), 'junk0001', { col: 1, row: 1 })).toBeNull()
  })

  it('picks up a Widget of a type this version does not know', () => {
    const unknown = layoutOf({ ...clock('futr0001', 1, 1), type: 'bookmarks' })
    expect(pickUp(editable(unknown), 'futr0001', { col: 0.5, row: 0.5 })).not.toBeNull()
  })

  it('holds a Widget that is drawn away from where it is stored at the place it is drawn', () => {
    // Stored on top of the Clock, so drawn in the free place nearest the middle instead.
    const crowded = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 5, 4))
    const drawn = drawnRects(crowded).find(({ widget }) => widget.placed.id === 'wthr0001')
    const session = held(crowded, 'wthr0001')
    expect(session.origin).toEqual(drawn?.rect)
  })
})

describe('moveSession, moving', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('keeps the Widget under the pointer where it was grabbed', () => {
    // Grabbed 1.5 cells in and 0.5 down from the Clock's top left corner.
    const session = held(layout, 'clock0001', { col: 4 + 1.5, row: 3 + 0.5 })
    const moved = move(session, { col: 4 + 1.5 - 2, row: 3 + 0.5 + 1 })
    expect(moved.at).toEqual({ col: 2, row: 4 })
    expect(moved.place).toEqual({ col: 3, h: 2, row: 5, w: 4 })
    expect(moved.valid).toBe(true)
  })

  it('snaps to the nearest cell', () => {
    const session = held(layout, 'clock0001')
    const at = (dx: number, dy: number) => move(session, corner(session, dx, dy)).place
    expect(at(0.4, 0).col).toBe(5)
    expect(at(0.6, 0).col).toBe(6)
    expect(at(-0.4, 0).col).toBe(5)
    expect(at(-0.6, 0).col).toBe(4)
    expect(at(0, 0.49).row).toBe(4)
    expect(at(0, 0.51).row).toBe(5)
    expect(at(0, -0.51).row).toBe(3)
  })

  it('never leaves the Grid: the place and the Widget under the pointer stop at its edges', () => {
    const session = held(layout, 'clock0001')
    const far = (dx: number, dy: number) => move(session, corner(session, dx, dy))

    const left = far(-40, 0)
    expect(left.place.col).toBe(1)
    expect(left.at.col).toBe(0)
    const right = far(40, 0)
    expect(right.place.col).toBe(COLS - 4 + 1)
    expect(right.at.col).toBe(COLS - 4)
    const top = far(0, -40)
    expect(top.place.row).toBe(1)
    expect(top.at.row).toBe(0)
    const bottom = far(0, 40)
    expect(bottom.place.row).toBe(ROWS - 2 + 1)
    expect(bottom.at.row).toBe(ROWS - 2)
    // At the edge is on the Grid, so it is allowed (the Weather is not in the way down there).
    expect(bottom.valid).toBe(true)
  })

  it('keeps the Widget on the Grid whatever the pointer does, for the biggest and smallest', () => {
    for (const [w, h] of [
      [1, 1],
      [COLS, ROWS],
    ] as const) {
      const big = layoutOf(clock('clock0001', 1, 1, w, h))
      const session = held(big, 'clock0001')
      for (const [dx, dy] of [
        [-100, -100],
        [100, 100],
        [3.3, 9.9],
      ] as const) {
        const { place } = move(session, corner(session, dx, dy))
        expect(place.col).toBeGreaterThanOrEqual(1)
        expect(place.row).toBeGreaterThanOrEqual(1)
        expect(place.col + place.w - 1).toBeLessThanOrEqual(COLS)
        expect(place.row + place.h - 1).toBeLessThanOrEqual(ROWS)
      }
    }
  })

  it('refuses a place on another Widget, and says where it would have gone', () => {
    // The Weather is at columns 11 and 12, rows 1 and 2.
    const session = held(layout, 'clock0001')
    const over = move(session, corner(session, 6, -3))
    // Pushed to the right edge: 4 wide from column 9 is the last that fits, and takes the Weather's cells.
    expect(over.place).toEqual({ col: 9, h: 2, row: 1, w: 4 })
    expect(over.valid).toBe(false)
  })

  it('allows a place that only touches another Widget', () => {
    const session = held(layout, 'clock0001')
    // Columns 7 to 10 and rows 1 and 2 sit right beside the Weather at column 11.
    const beside = move(session, corner(session, 2, -3))
    expect(beside.place).toEqual({ col: 7, h: 2, row: 1, w: 4 })
    expect(beside.valid).toBe(true)
  })

  it('allows a place that overlaps only the Widget being moved', () => {
    const session = held(layout, 'clock0001')
    const nudged = move(session, corner(session, 1, 0))
    expect(nudged.place.col).toBe(6)
    expect(nudged.valid).toBe(true)
  })

  it('is allowed again once the pointer leaves the other Widget', () => {
    const session = held(layout, 'clock0001')
    const over = move(session, corner(session, 6, -3))
    expect(over.valid).toBe(false)
    expect(move(over, corner(session, 0, 0)).valid).toBe(true)
  })

  it('does not change the session it was given, or the Layout', () => {
    const before = stored(layout)
    const session = held(layout, 'clock0001')
    const copy = structuredClone(session)
    move(session, corner(session, 3, 2))
    expect(session).toEqual(copy)
    expect(stored(layout)).toEqual(before)
  })
})

describe('moveSession, dropping', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('gives the next Layout, with the Widget at the place it was held at and nothing else changed', () => {
    const session = move(held(layout, 'clock0001'), { col: 1.2, row: 0.9 })
    const next = drop(session, editable(layout))
    expect(next).not.toBeNull()
    if (!next) return
    expect(stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 2, 2), weather('wthr0001', 11, 1))),
    )
    // The Layout it started from is as it was.
    expect(stored(layout)).toEqual(
      stored(layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))),
    )
  })

  it('gives one result however many moves came before it', () => {
    const first = held(layout, 'clock0001')
    let session = first
    for (let step = 1; step <= 20; step++) {
      session = move(session, corner(first, (step % 5) - 2, step % 3))
    }
    session = move(session, corner(first, -2, -1))
    const next = drop(session, editable(layout))
    expect(next && stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 3, 3), weather('wthr0001', 11, 1))),
    )
  })

  it('gives nothing where the place is refused, so the Widget goes back', () => {
    const session = held(layout, 'clock0001')
    const over = move(session, corner(session, 6, -3))
    expect(over.valid).toBe(false)
    expect(drop(over, editable(layout))).toBeNull()
  })

  it('gives nothing when the Widget was put down where it was', () => {
    const session = held(layout, 'clock0001')
    expect(drop(move(session, corner(session, 0.3, -0.2)), editable(layout))).toBeNull()
    expect(drop(session, editable(layout))).toBeNull()
  })

  it('gives nothing where the Layout may not be changed', () => {
    const session = move(held(layout, 'clock0001'), { col: 1.2, row: 0.9 })
    expect(drop(session, editable(layout, true))).toBeNull()
  })

  it('checks the place against the Layout as it is at the drop, not as it was at the pick-up', () => {
    const session = move(held(layout, 'clock0001'), { col: 1.2, row: 0.9 })
    // Another tab put a Weather on the cells the Clock is over.
    const meanwhile = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 2, 2))
    expect(drop(session, editable(meanwhile))).toBeNull()
  })

  it('gives nothing if the Widget is gone by the drop', () => {
    const session = move(held(layout, 'clock0001'), { col: 1.2, row: 0.9 })
    expect(drop(session, editable(layoutOf(weather('wthr0001', 11, 1))))).toBeNull()
  })

  it('moves a Widget of a type this version does not know, and keeps what it holds', () => {
    const unknown = layoutOf(
      { ...clock('futr0001', 1, 1, 2, 2), options: { colour: 'teal' }, type: 'bookmarks' },
      clock('clock0001', 5, 4),
    )
    const session = move(held(unknown, 'futr0001'), { col: 2.1, row: 2.1 })
    const next = drop(session, editable(unknown))
    expect(next && stored(next)).toEqual(
      stored(
        layoutOf(
          { ...clock('futr0001', 3, 3, 2, 2), options: { colour: 'teal' }, type: 'bookmarks' },
          clock('clock0001', 5, 4),
        ),
      ),
    )
  })
})

describe('moveSession, cancelling', () => {
  it('gives nothing to save, and leaves the Layout and the session as they were', () => {
    const layout = layoutOf(clock('clock0001', 5, 4))
    const before = stored(layout)
    const session = move(held(layout, 'clock0001'), { col: 1.2, row: 0.9 })
    const copy = structuredClone(session)
    expect(cancel(session)).toBeNull()
    expect(session).toEqual(copy)
    expect(stored(layout)).toEqual(before)
  })
})

describe('moveSession, the pointer in cells', () => {
  // A Grid 1200 by 800 pixels, 20 from the left and 16 from the top: cells of 100 by 100.
  const grid = { height: 800, left: 20, top: 16, width: 1200 }

  it('counts cells from the Grid, whatever the window is', () => {
    expect(toCells({ x: 20, y: 16 }, grid)).toEqual({ col: 0, row: 0 })
    expect(toCells({ x: 170, y: 66 }, grid)).toEqual({ col: 1.5, row: 0.5 })
    expect(toCells({ x: 1220, y: 816 }, grid)).toEqual({ col: COLS, row: ROWS })
    // The same pointer on a window half the size is the same place on the Grid.
    expect(
      toCells({ x: 20 + 300, y: 16 + 200 }, { height: 400, left: 20, top: 16, width: 600 }),
    ).toEqual({
      col: 6,
      row: 4,
    })
  })

  it('goes past the Grid where the pointer does', () => {
    expect(toCells({ x: 0, y: 0 }, grid)).toEqual({ col: -0.2, row: -0.16 })
  })

  it('has no cells to count on a Grid with no size', () => {
    expect(toCells({ x: 5, y: 5 }, { height: 0, left: 0, top: 0, width: 0 })).toBeNull()
  })
})
