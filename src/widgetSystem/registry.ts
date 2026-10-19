import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import type { DefinitionOf } from './definition'

/**
 * A definition with its types erased, so Widgets with different options and sources share one
 * list. `WidgetDefinition` is invariant in its types (its options are read and handed to a View),
 * so no narrower type will hold them all: `any` is deliberate here and in `DefinitionOf`. Each definition is
 * still written and checked against its own options type; only the list forgets it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWidgetDefinition = DefinitionOf<any>

/** Every Widget there is. */
export const WIDGETS: readonly AnyWidgetDefinition[] = [clockDefinition, weatherDefinition]

/** The Widget stored under `type`, or nothing when this version does not know it. */
export const widgetDefinition = (type: string): AnyWidgetDefinition | undefined =>
  WIDGETS.find((definition) => definition.type === type)
