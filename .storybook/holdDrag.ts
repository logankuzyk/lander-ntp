import { fireEvent } from 'storybook/test'

import { COLS, ROWS } from '@/layout/geometry'

import { startEditing } from './startEditing'

// A mouse with its button down: the page ends a press whose mouse moves with no button down.
const MOUSE = { button: 0, buttons: 1, isPrimary: true, pointerId: 1, pointerType: 'mouse' }

/**
 * For a story's `play`: presses Edit, then picks a Widget up as a person would and moves it by
 * `cols` columns and `rows` rows, and holds it there, with the pointer still down, so the story
 * is the drag in progress. Nothing is dropped, so nothing is saved. Leaving the story lets go.
 *
 * It sends the pointer events a mouse would, to the Widget's box, from its middle. Waits for the
 * Widget, as the page draws its Grid a beat after the first paint.
 */
export async function holdDrag(
  canvasElement: HTMLElement,
  widget: string,
  by: { cols: number; rows: number },
) {
  const canvas = await startEditing(canvasElement)
  const box = await canvas.findByRole('group', { name: widget })
  const grid = canvasElement.querySelector('.grid')
  if (!grid) throw new Error('no Grid')
  const gridBox = grid.getBoundingClientRect()
  const cell = { height: gridBox.height / ROWS, width: gridBox.width / COLS }
  const at = box.getBoundingClientRect()
  const start = { x: at.left + at.width / 2, y: at.top + at.height / 2 }

  fireEvent.pointerDown(box, { ...MOUSE, clientX: start.x, clientY: start.y })
  // A first small step makes it a drag (a press that wobbles is not one); then to the place.
  fireEvent.pointerMove(box, { ...MOUSE, clientX: start.x + 8, clientY: start.y })
  fireEvent.pointerMove(box, {
    ...MOUSE,
    clientX: start.x + by.cols * cell.width,
    clientY: start.y + by.rows * cell.height,
  })
  return canvas
}
