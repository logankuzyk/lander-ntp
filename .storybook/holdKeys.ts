import { userEvent } from 'storybook/test'

import { startEditing } from './startEditing'

/**
 * For a story's `play`: presses Edit, then focuses a Widget's frame and picks it up with Enter,
 * as a person at a keyboard would, then presses `keys` (in `userEvent.keyboard`'s syntax: an
 * arrow is `{ArrowRight}`, Shift and an arrow `{Shift>}{ArrowRight}{/Shift}`) and holds it there.
 * Nothing is put down, so nothing is saved. Waits for the Widget, as the page draws its Grid a
 * beat after the first paint.
 */
export async function holdKeys(canvasElement: HTMLElement, widget: string, keys: string[] = []) {
  const canvas = await startEditing(canvasElement)
  const box = await canvas.findByRole('group', { name: widget })
  box.focus()
  await userEvent.keyboard('{Enter}')
  for (const press of keys) await userEvent.keyboard(press)
  return canvas
}

/** `{ArrowRight}` pressed `times` times, for `holdKeys`. */
export const arrows = (name: 'Down' | 'Left' | 'Right' | 'Up', times: number, shift = false) =>
  Array.from({ length: times }, () => (shift ? `{Shift>}{Arrow${name}}{/Shift}` : `{Arrow${name}}`))
