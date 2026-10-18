import type { Settings } from '@/settings/schema'
import { clockDefinition } from '@/widgets/Clock/definition'

import type { PageValues } from './definition'

/** A Widget to draw: its `type`, and the options kept for it, which its definition reads. */
export type PlacedWidget = {
  options: Record<string, unknown>
  type: string
}

/**
 * Today's settings as the Widgets they show, in the order the page draws them. Phase 2 grows
 * this into the Layout, worked out from what is stored.
 */
export function widgetsFromSettings(settings: Settings): PlacedWidget[] {
  const widgets: PlacedWidget[] = []
  if (settings.clock.enabled) {
    widgets.push({
      options: { showDate: settings.clock.showDate, showSeconds: settings.clock.showSeconds },
      type: clockDefinition.type,
    })
  }
  return widgets
}

/** The settings that belong to the whole page, which any Widget may show. */
export const pageValues = (settings: Settings): PageValues => ({ hour12: settings.clock.hour12 })
