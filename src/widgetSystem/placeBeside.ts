/** The edges of something on the page, in pixels from the window's top left. */
export type Edges = { bottom: number; left: number; right: number; top: number }

/** How big something is, in pixels. */
export type Size = { height: number; width: number }

/**
 * Where the popover went, against the widget: `right` or `left` of it, `below` or `above` it, or
 * `over` it, which is only for a window with no room anywhere else.
 */
export type Side = 'above' | 'below' | 'left' | 'over' | 'right'

/** Where to put a popover: its top left corner, and the most height it may take. */
export type Placement = {
  left: number
  /** The height to stop at; the popover scrolls inside it when its contents are taller. */
  maxHeight: number
  side: Side
  top: number
}

/** Between the widget and the popover. */
export const GAP = 12
/** Between the popover and the window's edge. */
export const EDGE = 8
/**
 * The least height worth putting a popover above or below a widget in: it holds a header and a
 * few options. With less than this on either side it is put over the widget instead.
 */
const LEAST_HEIGHT = 160

export const clamp = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), Math.max(least, most))

/**
 * Where a popover goes against a widget (the options popover, beside its widget while it
 * changes). Pure: nothing is measured here. `anchor` is the widget's box, `size` the popover's
 * natural size and `viewport` the window's, all in pixels.
 *
 * The side with room, so the widget stays in view while its options change:
 *
 * 1. The right, level with the widget's top, if the popover's width fits there. Then the left.
 * 2. Otherwise (a narrow window, or a wide widget) below it, if all of its height fits there,
 *    then above. If neither has the height, whichever has more room, as long as that is a
 *    useful amount; the popover then scrolls inside the `maxHeight` it is given.
 * 3. Only when none of that has room is it put over the widget, in the middle of it.
 *
 * It is slid along the side it is on to stay in the window, and given the most height the window
 * has to spare, so that in a short window it scrolls inside rather than running off the page.
 */
export function placeBeside(anchor: Edges, size: Size, viewport: Size): Placement {
  const room = { height: viewport.height - 2 * EDGE, width: viewport.width - 2 * EDGE }
  const width = Math.min(size.width, room.width)
  const height = Math.min(size.height, room.height)

  // Beside the widget: level with its top, slid up if that would take it off the bottom.
  const beside = (side: 'left' | 'right', left: number): Placement => ({
    left,
    maxHeight: height,
    side,
    top: clamp(anchor.top, EDGE, viewport.height - EDGE - height),
  })
  const rightFrom = anchor.right + GAP
  if (viewport.width - EDGE - rightFrom >= width) return beside('right', rightFrom)
  const leftFrom = anchor.left - GAP - width
  if (leftFrom >= EDGE) return beside('left', leftFrom)

  // Above or below: left edges together, slid sideways to stay in the window.
  const across = clamp(anchor.left, EDGE, viewport.width - EDGE - width)
  const below = viewport.height - EDGE - (anchor.bottom + GAP)
  const above = anchor.top - GAP - EDGE
  const placeBelow = (): Placement => ({
    left: across,
    maxHeight: Math.min(size.height, below),
    side: 'below',
    top: anchor.bottom + GAP,
  })
  const placeAbove = (): Placement => {
    const used = Math.min(size.height, above)
    return { left: across, maxHeight: used, side: 'above', top: anchor.top - GAP - used }
  }
  if (below >= height) return placeBelow()
  if (above >= height) return placeAbove()
  if (Math.max(below, above) >= LEAST_HEIGHT) return below >= above ? placeBelow() : placeAbove()

  // No room anywhere: over the middle of the widget, in the window.
  const middle = { x: (anchor.left + anchor.right) / 2, y: (anchor.top + anchor.bottom) / 2 }
  return {
    left: clamp(middle.x - width / 2, EDGE, viewport.width - EDGE - width),
    maxHeight: height,
    side: 'over',
    top: clamp(middle.y - height / 2, EDGE, viewport.height - EDGE - height),
  }
}
