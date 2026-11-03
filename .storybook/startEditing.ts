import { userEvent, within } from 'storybook/test'

/**
 * For a story's `play`: presses Edit, as a person would, so the story is shown in edit mode.
 * Edit mode is page state and is never stored, so there is nothing to seed for it. Waits for the
 * button, as the page draws it at once but its stored settings land a beat after.
 */
export async function startEditing(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole('button', { name: 'Edit' }))
  return canvas
}
