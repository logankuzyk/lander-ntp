import { WIDGETS } from '@/widgetSystem/registry'

import { type CalloutTarget, findTarget, isShown, TARGET_ATTRIBUTE } from './target'
import type { PageFacts } from './tour'

/**
 * What the page draws now that decides the stops of its tour (see `planTour`): the first Widget
 * in the order of the page, of whatever type, and whether a setup button is on it. Whether the
 * Layout can be changed is the page's to say, not something it draws (`canChange`). Asked of the
 * page, as a Widget's need is worked out as it is drawn and is not in the Layout.
 */
export function pageFacts(canChange: boolean, root: ParentNode = document): PageFacts {
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
    canChange,
    menu: first ? `menu:${first.type}` : null,
    setup: findTarget('setup', root) !== null,
    widget,
  }
}
