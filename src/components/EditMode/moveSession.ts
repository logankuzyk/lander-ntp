import { clampSize, collides, COLS, drawnRects, type Rect, ROWS } from '@/layout/geometry'
import { type Editable, moveWidget, resizeWidget } from '@/layout/ops'
import type { Layout } from '@/layout/types'
import type { Cells } from '@/widgetSystem/definition'
import type { AnyWidgetDefinition } from '@/widgetSystem/registry'

/**
 * A point on the Grid in cells, counted from its top left corner: (0, 0) is that corner, (1, 0)
 * the line between columns 1 and 2. Fractions are how far into a cell. The adapter turns what the
 * pointer reports in pixels into this, so nothing here knows about the screen.
 */
export type Point = { col: number; row: number }

/**
 * What a Widget being moved and a Widget being resized have in common: which Widget, where it
 * was and what the others take, and where it would end up if dropped now.
 */
type Held = {
  /** How far into the Widget the pointer was when it was picked up, in cells. */
  readonly grab: Point
  readonly id: string
  /** Where the Widget was drawn when it was picked up, and goes back to. */
  readonly origin: Rect
  /** Where every other Widget is drawn, which the Widget may not take cells of. */
  readonly others: readonly Rect[]
  /** Where it would land if dropped now: whole cells, wholly on the Grid. */
  readonly place: Rect
  /** Whether the Widget may land there. False over another Widget. */
  readonly valid: boolean
}

/**
 * A Widget being moved, from the press to the drop. It is a value: every step gives the next
 * one, and none changes the one it was given or the Layout.
 */
export type MoveSession = Held & {
  /** Where the Widget is under the pointer: the corner of the pick-up, so it does not jump. */
  readonly at: Point
  readonly kind: 'move'
}

/**
 * A Widget being resized by its handle, at the bottom right corner: the same machine, with the
 * top left corner fixed and the size changing. `grab` is how far the pointer was from the bottom
 * right corner at the pick-up (the handle is a little inside it), so the Widget does not jump.
 * `place` is the snapped size and is refused over another Widget, as a move is.
 */
export type ResizeSession = Held & {
  /** The Widget's definition, which its smallest and largest sizes are read from. */
  readonly definition: AnyWidgetDefinition
  readonly kind: 'resize'
  /**
   * The size under the pointer, in cells and not snapped, kept between the Widget's smallest and
   * largest and on the Grid: what the Widget is drawn at while it follows the pointer.
   */
  readonly size: Cells
}

/** A Widget in the air, held by its body (a move) or by its handle (a resize). */
export type Session = MoveSession | ResizeSession

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
 * Picks up the handle of the Widget with this id, with the pointer at `pointer` (on the handle,
 * a little inside the Widget's bottom right corner). Nothing where the Layout may not be changed,
 * or there is no such Widget, or it has no place to be drawn, or it is of a type this version
 * does not know, which has no sizes to resize between.
 */
export function pickUpResize(
  { layout, readOnly }: Editable,
  id: string,
  pointer: Point,
): ResizeSession | null {
  if (readOnly) return null
  const drawn = drawnRects(layout)
  const mine = drawn.find(({ widget }) => widget.placed.id === id)
  if (mine?.widget.kind !== 'known') return null
  const { rect } = mine
  return {
    definition: mine.widget.definition,
    grab: {
      col: pointer.col - (rect.col - 1 + rect.w),
      row: pointer.row - (rect.row - 1 + rect.h),
    },
    id,
    kind: 'resize',
    origin: rect,
    others: drawn.filter((other) => other !== mine).map((other) => other.rect),
    place: rect,
    size: { h: rect.h, w: rect.w },
    valid: true,
  }
}

/**
 * The pointer is now at `pointer`.
 *
 * - A move: the Widget follows it (`at`), kept on the Grid, and `place` is the cell it snaps to:
 *   the nearest one, so it lands where it is nearest to being.
 * - A resize: the Widget's bottom right corner follows it and the top left stays put. `size` is
 *   the size under the pointer and `place` the whole cells it snaps to (the nearest). Both are
 *   kept between the Widget's smallest and largest (`clampSize`) and on the Grid (the most that
 *   fits from its top left corner), so it stops there however far the pointer goes.
 *
 * Over another Widget it is refused (`valid` is false), and `place` still says where it would
 * go, so that the outline can be drawn there in red.
 */
export function move(session: MoveSession, pointer: Point): MoveSession
export function move(session: ResizeSession, pointer: Point): ResizeSession
export function move(session: Session, pointer: Point): Session
export function move(session: Session, pointer: Point): Session {
  return session.kind === 'resize' ? resizeTo(session, pointer) : moveTo(session, pointer)
}

function moveTo(session: MoveSession, pointer: Point): MoveSession {
  const { h, w } = session.origin
  const at = {
    col: between(pointer.col - session.grab.col, 0, COLS - w),
    row: between(pointer.row - session.grab.row, 0, ROWS - h),
  }
  const place = { col: Math.round(at.col) + 1, h, row: Math.round(at.row) + 1, w }
  return { ...session, at, place, valid: !session.others.some((other) => collides(place, other)) }
}

function resizeTo(session: ResizeSession, pointer: Point): ResizeSession {
  const { definition, grab, origin } = session
  // The most that fits between its top left corner and the Grid's edge.
  const room = { h: ROWS - (origin.row - 1), w: COLS - (origin.col - 1) }
  const want = {
    h: pointer.row - grab.row - (origin.row - 1),
    w: pointer.col - grab.col - (origin.col - 1),
  }
  const within = (value: number, most: number) => Math.min(Math.max(value, 1), most)
  const size = clampSize(definition, { h: within(want.h, room.h), w: within(want.w, room.w) })
  const snapped = clampSize(definition, {
    h: within(Math.round(want.h), room.h),
    w: within(Math.round(want.w), room.w),
  })
  // A Widget stored at the edge under its smallest size has less room than that. It is refused,
  // and drawn in the room it has, which keeps the outline on the Grid.
  const fits = snapped.w <= room.w && snapped.h <= room.h
  const place = {
    col: origin.col,
    h: Math.min(snapped.h, room.h),
    row: origin.row,
    w: Math.min(snapped.w, room.w),
  }
  return {
    ...session,
    place,
    size: { h: Math.min(size.h, room.h), w: Math.min(size.w, room.w) },
    valid: fits && !session.others.some((other) => collides(place, other)),
  }
}

/**
 * Puts the Widget down where `session` has it. The next Layout, to save in one write, or null
 * where there is nothing to save: the place is refused, or it is where the Widget was (or the
 * size it had), or the Layout may not be changed. It is checked again against `editable`, which
 * is the Layout as it is now (another tab may have changed it since the pick-up), by
 * `moveWidget` or `resizeWidget`, so what is saved is what that operation allows.
 */
export function drop(session: Session, editable: Editable): Layout | null {
  if (session.kind === 'resize') return dropResize(session, editable)
  const { col, row } = session.place
  if (col === session.origin.col && row === session.origin.row) return null
  const result = moveWidget(editable, session.id, { col, row })
  if (!result.ok || result.layout === editable.layout) return null
  return result.layout
}

/**
 * The size is the one `move` already kept between the Widget's smallest and largest, so
 * `resizeWidget`, which refuses a size outside them and never clamps, is given one it allows
 * and has only the neighbours and the Grid to check.
 */
function dropResize(session: ResizeSession, editable: Editable): Layout | null {
  const { h, w } = session.place
  if (w === session.origin.w && h === session.origin.h) return null
  const result = resizeWidget(editable, session.id, { h, w })
  if (!result.ok || result.layout === editable.layout) return null
  return result.layout
}
