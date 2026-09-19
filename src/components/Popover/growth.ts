/** Roughly one line of text, for mice that scroll by lines rather than pixels. */
const LINE_PX = 16

const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

/**
 * How far a wheel event scrolls down, in pixels. `deltaY` is read before `deltaMode`: Firefox
 * reports lines to pages that ask for the mode first, and pixels otherwise.
 */
export function wheelPixels(event: WheelEvent, pageHeight: number): number {
  const delta = event.deltaY
  if (event.deltaMode === DOM_DELTA_LINE) return delta * LINE_PX
  if (event.deltaMode === DOM_DELTA_PAGE) return delta * pageHeight
  return delta
}

/**
 * Split a downward scroll between growing the grid and scrolling it. Growing comes first, up to
 * the room left, so the top row stays put until the grid is as tall as it gets.
 */
export function splitScroll(delta: number, room: number): { grow: number; scroll: number } {
  const grow = Math.max(0, Math.min(delta, room))
  return { grow, scroll: delta - grow }
}
