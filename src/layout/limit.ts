import { drawnRects } from './geometry'
import type { Layout } from './types'

/**
 * How many Widgets the Grid may hold at once (the Widget limit, LR-17), or `null` for no limit:
 * a later paid tier. Raising it takes nothing away; lowering it, or counting more, would.
 */
export const WIDGET_LIMIT: number | null = 8

/**
 * How many Widgets count toward the limit: every one the page draws, at any size, whatever its
 * type. That includes one of a type this version does not know and one waiting for setup; each
 * has a frame on the page and a × in edit mode.
 *
 * What is kept but not drawn does not count: a Widget that is not well-formed, and one with no
 * free place. Neither has a × and `removeWidget` cannot find a malformed one, so counting them
 * could use up the limit with no way out. Counting them is the stricter rule and the one that
 * cannot be loosened later, so it is left until something can remove them (the Layout is
 * otherwise unchanged by this).
 */
export function drawnCount(layout: Layout): number {
  return drawnRects(layout).length
}

/** Whether one more Widget may be added: the Layout is under the limit, or there is none. */
export function canAdd(layout: Layout, limit: number | null = WIDGET_LIMIT): boolean {
  return limit === null || drawnCount(layout) < limit
}
