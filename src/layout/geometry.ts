import type { Cells, DefinitionOf } from '@/widgetSystem/definition'

import type { KnownWidget, Layout, UnknownWidget } from './types'

/** The Grid is 12 columns by 8 rows, and its cells stretch with the window (see CONTEXT.md). */
export const COLS = 12
export const ROWS = 8

/**
 * A place on the Grid, in whole cells. Columns and rows count from 1, as CSS grid lines do, so
 * a place runs from `col` to `col + w - 1` and from `row` to `row + h - 1`.
 */
export type Rect = { col: number; h: number; row: number; w: number }

/** A Widget this version can place: one it knows, or one of a type it keeps without knowing. */
export type Drawable = KnownWidget | UnknownWidget

/** A Widget this version can draw, and the place to draw it in. */
export type DrawnWidget = { rect: Rect; widget: Drawable }

const isWhole = (value: number) => Number.isInteger(value)

/** Whether two places share a cell. Places that only touch do not. */
export function collides(a: Rect, b: Rect): boolean {
  return a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h
}

/** Whether a place is whole cells, at least one, and wholly on the Grid. */
export function isOnGrid(place: Rect): boolean {
  return (
    isWhole(place.col) &&
    isWhole(place.row) &&
    isWhole(place.w) &&
    isWhole(place.h) &&
    place.col >= 1 &&
    place.row >= 1 &&
    place.w >= 1 &&
    place.h >= 1 &&
    place.col + place.w - 1 <= COLS &&
    place.row + place.h - 1 <= ROWS
  )
}

/**
 * How far a place's centre is from the middle of the Grid, squared, in half cells so that it is
 * a whole number. The middle is the corner between columns 6 and 7 and between rows 4 and 5.
 */
function distanceFromMiddle(place: Rect): number {
  const across = 2 * place.col + place.w - (COLS + 2)
  const down = 2 * place.row + place.h - (ROWS + 2)
  return across * across + down * down
}

/**
 * The free place of this size nearest the middle of the Grid, or null where there is none (or
 * it is bigger than the Grid). Only a Widget an even number of columns wide and an even number
 * of rows high can be exactly in the middle. Places equally near are taken row by row from the
 * top, then column by column from the left, so the answer is always the same.
 */
export function nearestFreeToMiddle(size: Cells, taken: readonly Rect[]): Rect | null {
  let best: Rect | null = null
  let bestDistance = Infinity
  for (let row = 1; row + size.h - 1 <= ROWS; row++) {
    for (let col = 1; col + size.w - 1 <= COLS; col++) {
      const candidate = { col, h: size.h, row, w: size.w }
      if (taken.some((other) => collides(candidate, other))) continue
      const distance = distanceFromMiddle(candidate)
      if (distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
  }
  return best
}

/** `size` kept between the Widget's smallest and largest, one side at a time. */
export function clampSize<O>(definition: DefinitionOf<O>, size: Cells): Cells {
  const { largest, smallest } = definition.sizes
  return {
    h: Math.min(Math.max(size.h, smallest.h), largest.h),
    w: Math.min(Math.max(size.w, smallest.w), largest.w),
  }
}

/** The sizes from `starting` down to `smallest`, the one covering most cells first. */
function sizesDownTo(starting: Cells, smallest: Cells): Cells[] {
  const sizes: Cells[] = []
  for (let w = starting.w; w >= smallest.w; w--) {
    for (let h = starting.h; h >= smallest.h; h--) sizes.push({ h, w })
  }
  // The sort is stable: of two sizes covering as much, the wider comes first (it was pushed first).
  return sizes.sort((a, b) => b.w * b.h - a.w * a.h)
}

/**
 * Where a new Widget with these options goes, given the cells already `taken`: its starting size
 * in the free place nearest the middle, else the next smaller size that fits, down to its
 * smallest, else null.
 */
export function fitNew<O>(
  definition: DefinitionOf<O>,
  options: O,
  taken: readonly Rect[],
): Rect | null {
  const starting = clampSize(definition, definition.sizes.starting(options))
  for (const size of sizesDownTo(starting, definition.sizes.smallest)) {
    const place = nearestFreeToMiddle(size, taken)
    if (place) return place
  }
  return null
}

/** Reading order: row by row from the top, then left to right, then by id. */
function readingOrder(a: Drawable, b: Drawable): number {
  return (
    a.placed.row - b.placed.row ||
    a.placed.col - b.placed.col ||
    (a.placed.id < b.placed.id ? -1 : a.placed.id > b.placed.id ? 1 : 0)
  )
}

/**
 * Where every Widget of the Layout is drawn, in the order they are stored. Pure: the Layout is
 * not touched, and a Widget's stored place is never corrected here.
 *
 * - A Widget on the Grid and clear of the others is drawn where it is stored.
 * - One off the Grid, or on another, is drawn in the free place of its size nearest the middle,
 *   as adding one does. Of two Widgets on the same cells, the first in reading order keeps them.
 *   A Widget that is fine is never moved to make room for one that is not.
 * - One with no free place is not drawn. It stays in the Layout, and still counts as a Widget.
 * - A Widget that is not well-formed is not drawn and holds no cells.
 * - A Widget of a type this version does not know is placed like any other.
 *
 * The result does not depend on the order the Widgets are stored in.
 */
export function drawnRects(layout: Layout): DrawnWidget[] {
  const drawable = layout.widgets.filter(
    (widget): widget is Drawable => widget.kind !== 'malformed',
  )
  const where = new Map<Drawable, Rect>()
  const taken: Rect[] = []
  const displaced: Drawable[] = []

  for (const widget of [...drawable].sort(readingOrder)) {
    const { col, h, row, w } = widget.placed
    const stored = { col, h, row, w }
    if (isOnGrid(stored) && !taken.some((other) => collides(stored, other))) {
      where.set(widget, stored)
      taken.push(stored)
    } else {
      displaced.push(widget)
    }
  }
  for (const widget of displaced) {
    const { h, w } = widget.placed
    const place = nearestFreeToMiddle({ h, w }, taken)
    if (!place) continue
    where.set(widget, place)
    taken.push(place)
  }

  return drawable.flatMap((widget) => {
    const place = where.get(widget)
    return place ? [{ rect: place, widget }] : []
  })
}
