import { clockDefinition } from '@/widgets/Clock/definition'

import type { WidgetDefinition } from './definition'

/**
 * A definition with its options type erased, so Widgets with different options can share one
 * list. `WidgetDefinition<O>` is invariant in `O` (its options are read and handed to a View),
 * so no narrower type will hold them all: this is the one deliberate `any`. Each definition is
 * still written and checked against its own options type; only the list forgets it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetDefinition = WidgetDefinition<any>

/** Every Widget there is. */
export const WIDGETS: readonly AnyWidgetDefinition[] = [clockDefinition]

/** The Widget stored under `type`, or nothing when this version does not know it. */
export const widgetDefinition = (type: string): AnyWidgetDefinition | undefined =>
  WIDGETS.find((definition) => definition.type === type)
