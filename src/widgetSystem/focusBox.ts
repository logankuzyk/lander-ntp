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
    // Only the -1 it gave: by then edit mode may have made the box a tab stop (0), which stays.
    box.addEventListener(
      'blur',
      () => {
        if (box.getAttribute('tabindex') === '-1') box.removeAttribute('tabindex')
      },
      { once: true },
    )
  }
  return box
}
