import { fireEvent } from 'storybook/test'

import { COLS, ROWS } from '@/layout/geometry'

import { startEditing } from './startEditing'

// A mouse with its button down: the page ends a press whose mouse moves with no button down.
const MOUSE = { button: 0, buttons: 1, isPrimary: true, pointerId: 1, pointerType: 'mouse' }

/**
 * For a story's `play`: presses Edit, then takes a Widget by its handle, as a person would, and
 * pulls its bottom right corner by `cols` columns and `rows` rows, and holds it there, with the
 * pointer still down, so the story is the resize in progress. Nothing is dropped, so nothing is
 * saved. Leaving the story lets go.
 *
 * It sends the pointer events a mouse would, to the handle, from its middle. The corner follows
 * the pointer by the distance it moves, wherever on the handle it was pressed. Waits for the
 * Widget, as the page draws its Grid a beat after the first paint.
 */
export async function holdResize(
  canvasElement: HTMLElement,
  widget: string,
  by: { cols: number; rows: number },
) {
  const canvas = await startEditing(canvasElement)
  const box = await canvas.findByRole('group', { name: widget })
  const handle = box.querySelector('.widget-box__resize')
  if (!handle) throw new Error(`no resize handle on ${widget}`)
  const grid = canvasElement.querySelector('.grid')
  if (!grid) throw new Error('no Grid')
  const gridBox = grid.getBoundingClientRect()
  const cell = { height: gridBox.height / ROWS, width: gridBox.width / COLS }
  const at = handle.getBoundingClientRect()
  const start = { x: at.left + at.width / 2, y: at.top + at.height / 2 }

  fireEvent.pointerDown(handle, { ...MOUSE, clientX: start.x, clientY: start.y })
  // A first small step makes it a resize (a press that wobbles is not one); then to the size.
  fireEvent.pointerMove(handle, { ...MOUSE, clientX: start.x + 8, clientY: start.y })
  fireEvent.pointerMove(handle, {
    ...MOUSE,
    clientX: start.x + by.cols * cell.width,
    clientY: start.y + by.rows * cell.height,
  })
  return canvas
}
