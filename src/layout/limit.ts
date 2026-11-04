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
 * free place. Counting them would be the safer start (LR-17: a rule can be loosened for free,
 * not tightened), but neither has a × and `removeWidget` cannot find a malformed one, so with no
 * way to remove them it would strand the user at the limit. So they do not count. Counting them
 * later needs a way to remove them first (W27).
 *
 * Removing a drawn Widget can raise the count: with eight drawn and two undrawn for lack of room,
 * the freed cells let both be drawn (LR-15), so one removal leaves nine and it takes more to get
 * under. Nothing is hidden, and Undo may then take the Layout from eight to nine.
 */
export function drawnCount(layout: Layout): number {
  return drawnRects(layout).length
}

/** Whether one more Widget may be added: the Layout is under the limit, or there is none. */
export function canAdd(layout: Layout, limit: number | null = WIDGET_LIMIT): boolean {
  return limit === null || drawnCount(layout) < limit
}
