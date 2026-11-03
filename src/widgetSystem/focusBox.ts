/**
 * Makes a Widget's box able to take focus, and gives it back. The box is not a tab stop outside
 * edit mode, so it can only take focus while something gives it some: this sets `tabindex="-1"`
 * (a stop for a script, not for Tab), and takes it away again when focus moves on. A box that
 * already has a `tabindex` (it is a tab stop in edit mode) is left as it is. Returns the box, to
 * call `focus()` on.
 */
export function focusBox(box: HTMLElement): HTMLElement {
  if (!box.hasAttribute('tabindex')) {
    box.tabIndex = -1
    box.addEventListener('blur', () => box.removeAttribute('tabindex'), { once: true })
  }
  return box
}
