import type { Cells } from '@/widgetSystem/definition'
import { defaultOptions, readOptions } from '@/widgetSystem/options'
import { widgetDefinition } from '@/widgetSystem/registry'

import { layoutWidget, type Registry } from './check'
import { collides, type Drawable, drawnRects, fitNew, isOnGrid, type Rect } from './geometry'
import { newId } from './id'
import type { KnownWidget, Layout, WaitingOptions } from './types'

/**
 * Why a change to the Layout was refused:
 *
 * - `no room`: there is no free place for the Widget, or it has none to be drawn in.
 * - `not found`: there is no Widget with that id this version can place. A Widget that is not
 *   well-formed is kept as it was and never changed, so it is not found either.
 * - `outside`: the new place is not whole cells wholly on the Grid.
 * - `overlap`: the new place takes cells another Widget is drawn in.
 * - `read only`: a newer version wrote the Layout, so no change is allowed (see `useLayout`).
 * - `too large` / `too small`: the new size is over the Widget's largest or under its smallest.
 * - `unknown type`: this version has no definition for the Widget's type.
 */
export type Refusal =
  | 'no room'
  | 'not found'
  | 'outside'
  | 'overlap'
  | 'read only'
  | 'too large'
  | 'too small'
  | 'unknown type'

/** What `useLayout` gives that a change needs: the Layout, and whether it may be changed. */
export type Editable = { layout: Layout; readOnly: boolean }

/** A change that was allowed: the Layout as it is after it. The one it came from is untouched. */
export type Changed = { layout: Layout; ok: true }

/** A Widget that was added: the Layout after it, and the new Widget's id. */
export type Added = Changed & { id: string }

/** A change that was refused, and why. Nothing has changed. */
export type Refused = { ok: false; reason: Refusal }

const refused = (reason: Refusal): Refused => ({ ok: false, reason })

/** The Widget with this id, if this version can place it. */
function find(layout: Layout, id: string): Drawable | undefined {
  return layout.widgets.find(
    (widget): widget is Drawable => widget.kind !== 'malformed' && widget.placed.id === id,
  )
}

/** The Layout with one Widget replaced. */
function replace(layout: Layout, old: Drawable, next: Drawable): Layout {
  return { ...layout, widgets: layout.widgets.map((widget) => (widget === old ? next : widget)) }
}

/** Every id in the Layout, including those of Widgets that are kept but not drawn. */
function idsOf(layout: Layout): string[] {
  return layout.widgets.flatMap((widget) => {
    if (widget.kind !== 'malformed') return [widget.placed.id]
    const id = (widget.raw as { id?: unknown } | null)?.id
    return typeof id === 'string' ? [id] : []
  })
}

/** What `waiting` holds for a type, if anything, and the rest of it. */
function takeWaiting(
  layout: Layout,
  type: string,
): { rest: WaitingOptions | undefined; taken: unknown } {
  const waiting = layout.waiting as Record<string, unknown> | undefined
  if (!waiting || !(type in waiting)) return { rest: layout.waiting, taken: undefined }
  const { [type]: taken, ...rest } = waiting
  return { rest: Object.keys(rest).length === 0 ? undefined : (rest as WaitingOptions), taken }
}

/**
 * Adds a Widget of `type` at its starting size in the free place nearest the middle, or at the
 * next smaller size that fits, down to its smallest. Any number of one type may be added.
 *
 * It starts from the options an update kept for its type, if any are waiting, and takes them out
 * of `waiting` in the same Layout; every later one starts from the defaults. The Widget limit is
 * not checked here.
 */
export function addWidget(
  { layout, readOnly }: Editable,
  type: string,
  registry: Registry = widgetDefinition,
): Added | Refused {
  if (readOnly) return refused('read only')
  const definition = registry(type)
  if (!definition) return refused('unknown type')

  const { rest, taken: waitingOptions } = takeWaiting(layout, type)
  const options =
    waitingOptions === undefined
      ? (defaultOptions(definition) as Record<string, unknown>)
      : (readOptions(definition, waitingOptions) as Record<string, unknown>)

  const place = fitNew(
    definition,
    options,
    drawnRects(layout).map(({ rect }) => rect),
  )
  if (!place) return refused('no room')

  const id = newId(idsOf(layout))
  const widget = layoutWidget({ ...place, id, options, type }, registry)
  const next: Layout = { ...layout, widgets: [...layout.widgets, widget] }
  // `waiting` is optional, and absent once it is empty.
  if (rest === undefined) delete next.waiting
  else next.waiting = rest
  return { id, layout: next, ok: true }
}

/** Where a Widget is drawn now, or nothing when there is no place for it. */
function drawnPlace(layout: Layout, widget: Drawable): Rect | undefined {
  return drawnRects(layout).find((drawn) => drawn.widget === widget)?.rect
}

/** Whether `place` is wholly on the Grid and clear of every other Widget, as drawn. */
function checkPlace(layout: Layout, widget: Drawable, place: Rect): Refusal | null {
  if (!isOnGrid(place)) return 'outside'
  const overlaps = drawnRects(layout).some(
    (drawn) => drawn.widget !== widget && collides(place, drawn.rect),
  )
  return overlaps ? 'overlap' : null
}

/**
 * Moves a Widget so that its top left cell is `to`, keeping its size. It is checked against the
 * cells the other Widgets are drawn in, which is what the user sees. A Widget of a type this
 * version does not know can be moved.
 */
export function moveWidget(
  { layout, readOnly }: Editable,
  id: string,
  to: { col: number; row: number },
): Changed | Refused {
  if (readOnly) return refused('read only')
  const widget = find(layout, id)
  if (!widget) return refused('not found')
  const current = drawnPlace(layout, widget)
  if (!current) return refused('no room')

  const place = { col: to.col, h: current.h, row: to.row, w: current.w }
  const reason = checkPlace(layout, widget, place)
  if (reason) return refused(reason)

  const next = { ...widget, placed: { ...widget.placed, col: to.col, row: to.row } }
  return { layout: replace(layout, widget, next), ok: true }
}

/**
 * Gives a Widget a new size, keeping its top left cell (where it is drawn, if that is not where
 * it is stored). The size must be whole cells between the Widget's smallest and largest, and
 * fit on the Grid clear of the others. A Widget of a type this version does not know cannot be
 * resized: it has no sizes.
 */
export function resizeWidget(
  { layout, readOnly }: Editable,
  id: string,
  size: Cells,
): Changed | Refused {
  if (readOnly) return refused('read only')
  const widget = find(layout, id)
  if (!widget) return refused('not found')
  if (widget.kind === 'unknown') return refused('unknown type')

  const { largest, smallest } = widget.definition.sizes
  if (size.w < smallest.w || size.h < smallest.h) return refused('too small')
  if (size.w > largest.w || size.h > largest.h) return refused('too large')
  const current = drawnPlace(layout, widget)
  if (!current) return refused('no room')

  const place = { col: current.col, h: size.h, row: current.row, w: size.w }
  const reason = checkPlace(layout, widget, place)
  if (reason) return refused(reason)

  const next = { ...widget, placed: { ...widget.placed, ...place } }
  return { layout: replace(layout, widget, next), ok: true }
}

/**
 * Takes a Widget out of the Layout, along with its options. It can be a Widget of a type this
 * version does not know, or one with no place to be drawn.
 */
export function removeWidget({ layout, readOnly }: Editable, id: string): Changed | Refused {
  if (readOnly) return refused('read only')
  const widget = find(layout, id)
  if (!widget) return refused('not found')
  return {
    layout: { ...layout, widgets: layout.widgets.filter((other) => other !== widget) },
    ok: true,
  }
}

/**
 * Sets some of a Widget's stored options: the keys in `options` are written over what is stored,
 * and every other stored key stays, including keys this version does not know. A Widget whose
 * stored options failed their check is drawn with its defaults until this is called, so a
 * caller that changes one option of it passes the whole set it shows.
 */
export function setOptions(
  { layout, readOnly }: Editable,
  id: string,
  options: Record<string, unknown>,
): Changed | Refused {
  if (readOnly) return refused('read only')
  const widget = find(layout, id)
  if (!widget) return refused('not found')
  if (widget.kind === 'unknown') return refused('unknown type')

  const stored = { ...widget.placed.options, ...options }
  const next: KnownWidget = {
    ...widget,
    options: readOptions(widget.definition, stored) as Record<string, unknown>,
    placed: { ...widget.placed, options: stored },
  }
  return { layout: replace(layout, widget, next), ok: true }
}
