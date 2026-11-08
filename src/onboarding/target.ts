import type { Side } from './placeBeside'

/**
 * A thing on the page a callout can point at, found by its `data-callout-target` attribute:
 *
 * - `edit`: the Edit button in the Bottom bar (which reads Done while editing).
 * - `add`: the Add button beside it, in edit mode.
 * - `menu:<type>`: the item for a type of Widget in the Add menu.
 * - `widget:<type>`: a Widget's box, by its type, such as `widget:clock`.
 * - `options`: a Widget's Options button, in edit mode.
 * - `setup`: a Widget's setup button.
 *
 * Wherever more than one has the same value, such as two Widgets of one type, the first in the
 * order of the page is the one pointed at.
 */
export type CalloutTarget =
  'add' | 'edit' | 'options' | 'photo-heart' | 'setup' | `menu:${string}` | `widget:${string}`

/** The attribute that says what a thing on the page is, to a callout. */
export const TARGET_ATTRIBUTE = 'data-callout-target'

/** Anything that may point at the page: a stop of the tour or a piece of news. */
export type PageStop = { target?: CalloutTarget }

export const isShown = (element: Element) => {
  if (!element.isConnected) return false
  const { height, width } = element.getBoundingClientRect()
  // No box: it is not drawn (`display: none` on it or on something it is in), or not yet.
  if (width === 0 && height === 0) return false
  return getComputedStyle(element).visibility !== 'hidden'
}

/**
 * What the page draws for a target: the first thing in the order of the page that carries it and
 * is shown, or null if there is none. A callout whose target is null is not drawn, and a tour
 * goes on to its next stop (see `nextShown`).
 */
export function findTarget(target: CalloutTarget, root: ParentNode = document): HTMLElement | null {
  // Compared as text, not put in a selector: a value with a quote or a backslash in it is not
  // the selector's to parse.
  for (const element of root.querySelectorAll<HTMLElement>(`[${TARGET_ATTRIBUTE}]`)) {
    if (element.getAttribute(TARGET_ATTRIBUTE) === target && isShown(element)) return element
  }
  return null
}

/**
 * The first stop from `from` on that can be shown: one that points at nothing on the page (a
 * stop in the settings panel), or whose target is there. Null when no stop is left. A stop
 * whose target is missing is skipped, not waited for.
 */
export function nextShown(stops: readonly PageStop[], from: number): number | null {
  for (let index = from; index < stops.length; index += 1) {
    const { target } = stops[index] ?? {}
    if (target === undefined || findTarget(target) !== null) return index
  }
  return null
}

/**
 * The sides a callout tries first for a target, best first. The Bottom bar's buttons are at the
 * foot of the window, so above them; a Widget has room beside it; a menu opens upward from its
 * button, so a callout beside an item stays off the menu's open side.
 */
export function preferredSides(target: CalloutTarget): readonly Side[] {
  if (target === 'edit' || target === 'add') return ['above', 'left']
  if (target.startsWith('menu:')) return ['left', 'right', 'above', 'below']
  if (target === 'options') return ['left', 'above', 'right', 'below']
  return ['right', 'left', 'below', 'above']
}
