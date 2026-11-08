import { describe, expect, it } from 'vitest'

import { checkLayout, storedLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'

import { dropKeys, type KeySession, nudge, pickUpKeys, stretch } from './moveSession'

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

type StoredWidget = { col: number; h: number; id: string; row: number; w: number }
const storedWidgets = (layout: Layout) =>
  (JSON.parse(JSON.stringify(storedLayout(layout))) as { widgets: StoredWidget[] }).widgets

function held(layout: Layout, id: string): KeySession {
  const session = pickUpKeys(editable(layout), id)
  if (!session) throw new Error(`could not pick up ${id}`)
  return session
}

/** What an arrow key says: a step of one cell. */
const RIGHT = { cols: 1, rows: 0 }
const LEFT = { cols: -1, rows: 0 }
const DOWN = { cols: 0, rows: 1 }
const UP = { cols: 0, rows: -1 }

function press(session: KeySession, step: typeof RIGHT, times: number, how = nudge): KeySession {
  let next = session
  for (let i = 0; i < times; i++) next = how(next, step)
  return next
}

describe('keyboard session, picking up', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('holds the Widget where it is drawn, at its size, in a place that is allowed', () => {
    const session = held(layout, 'clock0001')
    expect(session.kind).toBe('keys')
    expect(session.origin).toEqual({ col: 5, h: 2, row: 4, w: 4 })
    expect(session.place).toEqual(session.origin)
    expect(session.valid).toBe(true)
    expect(session.limit).toBeNull()
  })

  it('knows the cells the other Widgets are drawn in', () => {
    expect(held(layout, 'clock0001').others).toEqual([{ col: 11, h: 2, row: 1, w: 2 }])
  })

  it('picks up nothing for an unknown id, a Layout that may not change, or a Widget not well-formed', () => {
    expect(pickUpKeys(editable(layout), 'nothing1')).toBeNull()
    expect(pickUpKeys(editable(layout, true), 'clock0001')).toBeNull()
    const bad = layoutOf(clock('clock0001', 5, 4), { id: 'junk0001', type: 'clock' })
    expect(pickUpKeys(editable(bad), 'junk0001')).toBeNull()
  })

  it('picks up a Widget of a type this version does not know, which can move but not resize', () => {
    const future = layoutOf({ ...clock('futr0001', 5, 4), type: 'future-widget' })
    const session = held(future, 'futr0001')
    expect(nudge(session, RIGHT).place.col).toBe(6)
    const stretched = stretch(session, RIGHT)
    expect(stretched.place).toEqual(session.place)
    expect(stretched.limit).toBe('unresizable')
  })
})

describe('keyboard session, moving a cell at a time', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('moves one cell in the direction of the arrow, keeping the size', () => {
    const session = held(layout, 'clock0001')
    expect(nudge(session, RIGHT).place).toEqual({ col: 6, h: 2, row: 4, w: 4 })
    expect(nudge(session, LEFT).place).toEqual({ col: 4, h: 2, row: 4, w: 4 })
    expect(nudge(session, DOWN).place).toEqual({ col: 5, h: 2, row: 5, w: 4 })
    expect(nudge(session, UP).place).toEqual({ col: 5, h: 2, row: 3, w: 4 })
  })

  it('does not change the session it was given', () => {
    const session = held(layout, 'clock0001')
    nudge(session, RIGHT)
    expect(session.place).toEqual({ col: 5, h: 2, row: 4, w: 4 })
  })

  it('stops at the Grid’s edges and says it was the edge', () => {
    const left = press(held(layout, 'clock0001'), LEFT, 10)
    expect(left.place.col).toBe(1)
    expect(left.limit).toBe('edge')
    expect(left.valid).toBe(true)

    // 12 columns, 4 wide: the last place is column 9.
    expect(press(held(layout, 'clock0001'), RIGHT, 10).place.col).toBe(9)
    expect(press(held(layout, 'clock0001'), RIGHT, 10).limit).toBe('edge')

    // 8 rows, 2 high: the last place is row 7.
    expect(press(held(layout, 'clock0001'), DOWN, 10).place.row).toBe(7)
    expect(press(held(layout, 'clock0001'), UP, 10).place.row).toBe(1)
  })

  it('clears the edge note once a step goes through', () => {
    const edge = press(held(layout, 'clock0001'), LEFT, 10)
    expect(nudge(edge, RIGHT).limit).toBeNull()
  })

  it('is refused over another Widget, where it still says where it would go', () => {
    // The Weather is at columns 11 and 12, rows 1 and 2; the Clock at row 1 walks onto it.
    let session = press(held(layout, 'clock0001'), UP, 3)
    expect(session.place).toEqual({ col: 5, h: 2, row: 1, w: 4 })
    expect(session.valid).toBe(true)
    session = press(session, RIGHT, 2)
    // Columns 7 to 10: touching the Weather at column 11 is not overlap.
    expect(session.place.col).toBe(7)
    expect(session.valid).toBe(true)
    session = nudge(session, RIGHT)
    expect(session.place.col).toBe(8)
    expect(session.valid).toBe(false)
  })

  it('can be walked past a neighbour, and is allowed again on the far side', () => {
    const crowd = layoutOf(clock('clock0001', 1, 1, 3), weather('wthr0001', 4, 1))
    let session = held(crowd, 'clock0001')
    const seen: boolean[] = []
    for (let i = 0; i < 5; i++) {
      session = nudge(session, RIGHT)
      seen.push(session.valid)
    }
    // Columns 2-4, 3-5, 4-6 and 5-7 take a cell of the Weather (4 and 5), 6-8 is clear of it.
    expect(seen).toEqual([false, false, false, false, true])
    expect(session.place.col).toBe(6)
  })

  it('is allowed again when it is back where it started', () => {
    let session = press(held(layout, 'clock0001'), UP, 2)
    session = press(session, DOWN, 2)
    expect(session.place).toEqual(session.origin)
    expect(session.valid).toBe(true)
  })
})

describe('keyboard session, resizing a cell at a time', () => {
  const layout = layoutOf(clock('clock0001', 3, 3, 4), weather('wthr0001', 11, 1))

  it('grows and shrinks from the top left corner, one cell at a time', () => {
    const session = held(layout, 'clock0001')
    expect(stretch(session, RIGHT).place).toEqual({ col: 3, h: 2, row: 3, w: 5 })
    expect(stretch(session, LEFT).place).toEqual({ col: 3, h: 2, row: 3, w: 3 })
    expect(stretch(session, DOWN).place).toEqual({ col: 3, h: 3, row: 3, w: 4 })
    // It is already as short as it goes.
    expect(stretch(session, UP).place).toEqual({ col: 3, h: 2, row: 3, w: 4 })
  })

  it('stops at the largest and the smallest, and says which', () => {
    let session = press(held(layout, 'clock0001'), RIGHT, 10, stretch)
    expect(session.place.w).toBe(8)
    expect(session.limit).toBe('largest')
    session = press(session, LEFT, 10, stretch)
    expect(session.place.w).toBe(3)
    expect(session.limit).toBe('smallest')
    session = press(session, DOWN, 10, stretch)
    expect(session.place.h).toBe(4)
    expect(session.limit).toBe('largest')
    session = press(session, UP, 10, stretch)
    expect(session.place.h).toBe(2)
    expect(session.limit).toBe('smallest')
  })

  it('stops at the Grid’s edge when that comes before the largest', () => {
    let session = held(layoutOf(clock('clock0001', 9, 3, 3)), 'clock0001')
    session = stretch(session, RIGHT)
    expect(session.place.w).toBe(4)
    session = stretch(session, RIGHT)
    expect(session.place.w).toBe(4)
    expect(session.limit).toBe('edge')
  })

  it('is refused over a neighbour, as a pointer’s resize is', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    let session = stretch(held(beside, 'clock0001'), RIGHT)
    // Columns 3 to 7 touch the Weather at column 8 and do not overlap it.
    expect(session.valid).toBe(true)
    session = stretch(session, RIGHT)
    expect(session.valid).toBe(false)
    expect(stretch(session, LEFT).valid).toBe(true)
  })

  it('resizes the place it has been moved to, in the same pick-up', () => {
    let session = nudge(nudge(held(layout, 'clock0001'), RIGHT), DOWN)
    session = stretch(stretch(session, RIGHT), DOWN)
    expect(session.place).toEqual({ col: 4, h: 3, row: 4, w: 5 })
    expect(session.origin).toEqual({ col: 3, h: 2, row: 3, w: 4 })
  })
})

describe('keyboard session, putting down', () => {
  const layout = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

  it('gives the next Layout with the Widget at the place, moved and resized together', () => {
    let session = nudge(nudge(held(layout, 'clock0001'), LEFT), UP)
    session = stretch(session, RIGHT)
    const next = dropKeys(session, editable(layout))
    if (!next) throw new Error('nothing to save')
    const widgets = storedWidgets(next)
    expect(widgets.find((w) => w.id === 'clock0001')).toMatchObject({ col: 4, h: 2, row: 3, w: 5 })
    expect(widgets.find((w) => w.id === 'wthr0001')).toMatchObject({ col: 11, h: 2, row: 1, w: 2 })
  })

  it('gives nothing to save where the Widget is back where it was', () => {
    const session = nudge(nudge(held(layout, 'clock0001'), RIGHT), LEFT)
    expect(dropKeys(session, editable(layout))).toBeNull()
    expect(dropKeys(held(layout, 'clock0001'), editable(layout))).toBeNull()
  })

  it('gives nothing to save from a refused place', () => {
    const session = press(press(held(layout, 'clock0001'), UP, 3), RIGHT, 3)
    expect(session.valid).toBe(false)
    expect(dropKeys(session, editable(layout))).toBeNull()
  })

  it('checks the place again against the Layout as it is now', () => {
    const session = nudge(held(layout, 'clock0001'), RIGHT)
    // Another tab put the Weather where the Clock was going.
    const taken = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 9, 4, 2, 2))
    expect(dropKeys(session, editable(taken))).toBeNull()
  })

  it('gives nothing to save on a Layout that may not be changed', () => {
    const session = nudge(held(layout, 'clock0001'), RIGHT)
    expect(dropKeys(session, editable(layout, true))).toBeNull()
  })
})
