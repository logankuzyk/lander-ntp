import { readOptions } from '@/widgetSystem/options'
import { type AnyWidgetDefinition, widgetDefinition } from '@/widgetSystem/registry'

import type { Layout, LayoutWidget, PlacedWidget, StoredLayout, WaitingOptions } from './types'

/** Finds the Widget stored under a `type`, or nothing when this version does not know it. */
export type Registry = (type: string) => AnyWidgetDefinition | undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWholeCells = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1

/**
 * Whether a stored value has the shape of a Layout at all: an object with a list of Widgets,
 * and waiting options, if there are any, in an object. A value that does not is read as an
 * empty Layout and is never written over (see `layoutItem`), as nothing can be told of what it
 * holds. What is wrong with one Widget in the list is not a reason: see `layoutWidget`.
 */
export function isLayoutReadable(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    Array.isArray(raw.widgets) &&
    (raw.waiting === undefined || isRecord(raw.waiting))
  )
}

/**
 * One stored Widget as the page holds it. A place has to be whole cells (1 or more), but not
 * on the Grid: where a Widget can be drawn is for the Grid to say, and its stored place is left
 * alone. A Widget that is not well-formed is `malformed`, one of a type this version does not
 * know is `unknown`, and neither is drawn by anything here.
 */
export function layoutWidget(raw: unknown, registry: Registry = widgetDefinition): LayoutWidget {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    raw.id === '' ||
    typeof raw.type !== 'string' ||
    !isRecord(raw.options) ||
    !isWholeCells(raw.col) ||
    !isWholeCells(raw.row) ||
    !isWholeCells(raw.w) ||
    !isWholeCells(raw.h)
  ) {
    return { kind: 'malformed', raw }
  }
  // Every field is checked above; the rest of the object is kept as it is.
  const placed = raw as PlacedWidget
  const definition = registry(placed.type)
  if (!definition) return { kind: 'unknown', placed }
  return {
    definition,
    kind: 'known',
    // Pure: what is stored is not touched, so options failing their check are drawn as the
    // defaults and stay as they were until the user changes this Widget's options.
    options: readOptions(definition, placed.options) as Record<string, unknown>,
    placed,
  }
}

/**
 * Makes the stored Layout into what the page holds. Pure, and never writes. It keeps what it
 * does not recognise at every level (a top-level key, a Widget it has no definition for, an
 * option key), and the Widget limit is not part of it: a Layout with more Widgets than the
 * limit loads whole. A value with no shape to read is an empty Layout; see `isLayoutReadable`.
 */
export function checkLayout(raw: unknown, registry: Registry = widgetDefinition): Layout {
  if (!isLayoutReadable(raw)) return { extra: {}, widgets: [] }
  const { waiting, widgets, ...rest } = raw as Record<string, unknown>
  // `v` is the guard's business (see storage/guard) and is stamped on again when stored.
  const extra = Object.fromEntries(Object.entries(rest).filter(([key]) => key !== 'v'))

  const taken = new Set<string>()
  return {
    extra,
    ...(waiting === undefined ? {} : { waiting: waiting as WaitingOptions }),
    widgets: (widgets as unknown[]).map((entry) => {
      const widget = layoutWidget(entry, registry)
      if (widget.kind === 'malformed') return widget
      // An id used twice is one Widget too many to key on: the later one is kept, not drawn.
      if (taken.has(widget.placed.id)) return { kind: 'malformed', raw: entry } as const
      taken.add(widget.placed.id)
      return widget
    }),
  }
}

/** What is stored for a Layout: everything it was read from, and `v: 1`. */
export function storedLayout(layout: Layout): StoredLayout {
  return {
    // First, so that a key in `extra` can never replace one of the keys below.
    ...layout.extra,
    v: 1,
    widgets: layout.widgets.map((widget) =>
      widget.kind === 'malformed' ? (widget.raw as PlacedWidget) : widget.placed,
    ),
    ...(layout.waiting === undefined ? {} : { waiting: layout.waiting }),
  }
}
