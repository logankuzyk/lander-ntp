import type { Layout } from '@/layout/types'

import type { DefinitionOf } from './definition'

/**
 * What a Widget's box is called to a screen reader, and what its frame says in edit mode: the
 * definition's `name`, then its `summary` of the options when it gives one ("Weather, Victoria"),
 * so that two of the same type can be told apart. `options` are the options as the definition
 * reads them (see `readOptions`).
 *
 * It follows the options and nothing else. A name that followed what the Widget shows, such as
 * the Clock's time, would change as often as that does.
 */
export function accessibleName<O>(definition: DefinitionOf<O>, options: O): string {
  const summary = definition.summary?.(options)?.trim()
  return summary ? `${definition.name}, ${summary}` : definition.name
}

/** The most of a stored type that goes into the name of a Widget this version does not know. */
const MOST_TYPE = 30

/**
 * What a Widget of a type this version does not know is called: "Unknown widget" and its type,
 * and its place among the others of that type, in the order the Layout stores them, when there
 * is more than one ("Unknown widget, bookmarks 2"). So that the boxes, their frames and the
 * line that says one was removed tell them apart, as the summary does for a Weather. The type
 * is whatever a newer version stored, cut short if it is very long.
 */
export function unknownWidgetName(layout: Layout, id: string): string {
  const same = layout.widgets.filter((widget) => widget.kind === 'unknown')
  const own = same.find((widget) => widget.placed.id === id)
  if (!own) return 'Unknown widget'
  const type =
    own.placed.type.length > MOST_TYPE ? `${own.placed.type.slice(0, MOST_TYPE)}…` : own.placed.type
  if (type === '') return 'Unknown widget'
  const ofType = same.filter((widget) => widget.placed.type === own.placed.type)
  return ofType.length > 1
    ? `Unknown widget, ${type} ${ofType.indexOf(own) + 1}`
    : `Unknown widget, ${type}`
}
