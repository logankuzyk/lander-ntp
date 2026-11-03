import { clamp, EDGE, type Edges, GAP, type Size } from '@/widgetSystem/placeBeside'

export type { Edges, Size }

/** Which side of its target a callout is on. */
export type Side = 'above' | 'below' | 'left' | 'right'

/** Where to put a callout, and where its pointer goes. */
export type Placement = {
  /** The callout's left edge, in pixels from the window's left. */
  left: number
  /**
   * How far along the callout's edge facing the target (from its left, or from its top) the
   * pointer is: the point opposite the middle of the target, kept off the rounded corners.
   */
  pointer: number
  side: Side
  /** The callout's top edge, in pixels from the window's top. */
  top: number
}

type Options = {
  /** What is open and must stay clear of the callout: a menu, a popover. */
  avoid?: readonly Edges[]
  /** Where to try first, in order. The sides not named are tried after them, in `ORDER`. */
  prefer?: readonly Side[]
  /**
   * The box of something the target is in, such as the menu an item is in. The callout goes
   * beside that and not on it: level with the target (right or left), centred on it (above or
   * below), and clear of the whole box.
   */
  within?: Edges
}

/** The least the pointer is from either end of its edge: clear of the rounded corners. */
const CORNER = 20

/** Where to look when the caller has no preference. */
const ORDER: readonly Side[] = ['right', 'left', 'below', 'above']

const overlap = (a: Edges, b: Edges) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

type Candidate = Placement & {
  /** The callout's box, as placed. */
  box: Edges
  /** Whether the callout is wholly on its side of the target and in the window. */
  fits: boolean
  /** How much room there is on that side, which is negative when there is none. */
  room: number
}

/**
 * Where a callout goes against the thing it points at. Pure: nothing is measured here. `target`
 * is its box, `size` the callout's and `viewport` the window's, all in pixels from the window's
 * top left. `within` is the box of what the target is in, if anything (see `Options`).
 *
 * It goes on the first side that has room, from `prefer` and then the rest, level with the middle
 * of the target (right or left) or centred on it (above or below), slid along that side so that
 * it stays in the window. A side has room when the whole callout fits between the target and the
 * window's edge, and none of `avoid` is under it. If every side that fits is covered by
 * something open, it takes the one covered least. If no side fits (a window smaller than the
 * callout and its target together), it takes the one with the most room and still stays inside
 * the window, so the callout can be read; it may then lie over part of the target.
 *
 * The pointer is where the callout's edge faces the middle of the target, so it still points at
 * it when the callout has had to slide.
 */
export function placeBeside(
  target: Edges,
  size: Size,
  viewport: Size,
  { avoid = [], prefer = [], within }: Options = {},
): Placement {
  const { height, width } = size
  // What the callout keeps its distance from: the target, or what the target is in.
  const frame = within ?? target
  const middle = { x: (target.left + target.right) / 2, y: (target.top + target.bottom) / 2 }
  const leftMost = EDGE
  const leftLeast = viewport.width - EDGE - width
  const topMost = EDGE
  const topLeast = viewport.height - EDGE - height

  const candidate = (side: Side): Candidate => {
    let left: number
    let top: number
    let room: number
    if (side === 'right' || side === 'left') {
      left = side === 'right' ? frame.right + GAP : frame.left - GAP - width
      top = clamp(middle.y - height / 2, topMost, topLeast)
      room =
        side === 'right'
          ? viewport.width - EDGE - frame.right - GAP - width
          : frame.left - GAP - width - EDGE
    } else {
      left = clamp(middle.x - width / 2, leftMost, leftLeast)
      top = side === 'below' ? frame.bottom + GAP : frame.top - GAP - height
      room =
        side === 'below'
          ? viewport.height - EDGE - frame.bottom - GAP - height
          : frame.top - GAP - height - EDGE
    }
    // On a side with no room it is slid into the window, even over the target.
    if (room < 0) {
      left = clamp(left, leftMost, leftLeast)
      top = clamp(top, topMost, topLeast)
    }
    const along = side === 'right' || side === 'left'
    const pointer = clamp(
      along ? middle.y - top : middle.x - left,
      CORNER,
      (along ? height : width) - CORNER,
    )
    const box = { bottom: top + height, left, right: left + width, top }
    return { box, fits: room >= 0, left, pointer, room, side, top }
  }

  const order = [...new Set([...prefer, ...ORDER])]
  const candidates = order.map(candidate)
  const covered = (c: Candidate) => avoid.reduce((sum, rect) => sum + overlap(c.box, rect), 0)

  const fitting = candidates.filter((c) => c.fits)
  const chosen =
    fitting.find((c) => covered(c) === 0) ??
    // Least covered; the first of equals, so the order of preference holds.
    fitting.reduce<Candidate | undefined>(
      (best, c) => (best === undefined || covered(c) < covered(best) ? c : best),
      undefined,
    ) ??
    candidates.reduce((best, c) => (c.room > best.room ? c : best))

  const { left, pointer, side, top } = chosen
  return { left, pointer, side, top }
}
