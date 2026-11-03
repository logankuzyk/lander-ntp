import { collides, COLS, drawnRects, type Rect, ROWS } from '@/layout/geometry'
import { type Editable, moveWidget } from '@/layout/ops'
import type { Layout } from '@/layout/types'

/**
 * A point on the Grid in cells, counted from its top left corner: (0, 0) is that corner, (1, 0)
 * the line between columns 1 and 2. Fractions are how far into a cell. The adapter turns what the
 * pointer reports in pixels into this, so nothing here knows about the screen.
 */
export type Point = { col: number; row: number }

/**
 * A Widget being moved, from the press to the drop. It is a value: every step gives the next
 * one, and none changes the one it was given or the Layout.
 *
 * `kind` is there for the resize that shares this machine later (W22).
 */
export type MoveSession = {
  /** Where the Widget is under the pointer: the corner of the pick-up, so it does not jump. */
  readonly at: Point
  /** How far into the Widget the pointer was when it was picked up, in cells. */
  readonly grab: Point
  readonly id: string
  readonly kind: 'move'
  /** Where the Widget was drawn when it was picked up, and goes back to. */
  readonly origin: Rect
  /** Where every other Widget is drawn, which the Widget may not take cells of. */
  readonly others: readonly Rect[]
  /** Where it would land if dropped now: whole cells, wholly on the Grid. */
  readonly place: Rect
  /** Whether the Widget may land there. False over another Widget. */
  readonly valid: boolean
}

/** Where the Grid is on the screen, in pixels: what `getBoundingClientRect` says of it. */
export type GridBox = { height: number; left: number; top: number; width: number }

/**
 * Where a pointer at `client` (pixels, as the browser reports it) is on the Grid, in cells.
 * Null when the Grid has no size to count cells by (it is not on the screen).
 */
export function toCells(client: { x: number; y: number }, grid: GridBox): Point | null {
  if (grid.width <= 0 || grid.height <= 0) return null
  return {
    col: ((client.x - grid.left) / grid.width) * COLS,
    row: ((client.y - grid.top) / grid.height) * ROWS,
  }
}

const between = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), most)

/**
 * Picks up the Widget with this id, with the pointer at `pointer`. Nothing where the Layout may
 * not be changed, or there is no such Widget, or it has no place to be drawn: that is nothing to
 * drag. A Widget of a type this version does not know can be picked up.
 */
export function pickUp(
  { layout, readOnly }: Editable,
  id: string,
  pointer: Point,
): MoveSession | null {
  if (readOnly) return null
  const drawn = drawnRects(layout)
  const mine = drawn.find(({ widget }) => widget.placed.id === id)
  if (!mine) return null
  const { rect } = mine
  return {
    at: { col: rect.col - 1, row: rect.row - 1 },
    grab: { col: pointer.col - (rect.col - 1), row: pointer.row - (rect.row - 1) },
    id,
    kind: 'move',
    origin: rect,
    others: drawn.filter((other) => other !== mine).map((other) => other.rect),
    place: rect,
    valid: true,
  }
}

/**
 * The pointer is now at `pointer`. The Widget follows it (`at`), kept on the Grid, and `place`
 * is the cell it snaps to: the nearest one, so it lands where it is nearest to being. Over
 * another Widget it is refused (`valid` is false), and `place` still says where it would go,
 * so that the outline can be drawn there in red.
 */
export function move(session: MoveSession, pointer: Point): MoveSession {
  const { h, w } = session.origin
  const at = {
    col: between(pointer.col - session.grab.col, 0, COLS - w),
    row: between(pointer.row - session.grab.row, 0, ROWS - h),
  }
  const place = { col: Math.round(at.col) + 1, h, row: Math.round(at.row) + 1, w }
  return { ...session, at, place, valid: !session.others.some((other) => collides(place, other)) }
}

/**
 * Puts the Widget down where `session` has it. The next Layout, to save in one write, or null
 * where there is nothing to save: the place is refused, or it is where the Widget was, or the
 * Layout may not be changed. It is checked again against `editable`, which is the Layout as it
 * is now (another tab may have changed it since the pick-up), by `moveWidget`, so what is saved
 * is what that operation allows.
 */
export function drop(session: MoveSession, editable: Editable): Layout | null {
  const { col, row } = session.place
  if (col === session.origin.col && row === session.origin.row) return null
  const result = moveWidget(editable, session.id, { col, row })
  if (!result.ok || result.layout === editable.layout) return null
  return result.layout
}

/** Puts the Widget back. There is nothing to save: the Layout was never changed. */
export function cancel(_session: MoveSession): null {
  return null
}
