import { WIDGETS } from '@/widgetSystem/registry'

import { type CalloutTarget, findTarget, isShown, TARGET_ATTRIBUTE } from './target'
import type { PageFacts } from './tour'

/**
 * What the page draws now that decides the stops of its tour (see `planTour`): the first Widget
 * in the order of the page, of whatever type, and whether a setup button is on it. Asked of the
 * page, as a Widget's need is worked out as it is drawn and is not in the Layout.
 */
export function pageFacts(root: ParentNode = document): PageFacts {
  let widget: CalloutTarget | null = null
  for (const element of root.querySelectorAll<HTMLElement>(`[${TARGET_ATTRIBUTE}]`)) {
    const value = element.getAttribute(TARGET_ATTRIBUTE)
    if (value?.startsWith('widget:') && isShown(element)) {
      widget = value as CalloutTarget
      break
    }
  }
  const first = WIDGETS[0]
  return {
    menu: first ? `menu:${first.type}` : null,
    setup: findTarget('setup', root) !== null,
    widget,
  }
}
