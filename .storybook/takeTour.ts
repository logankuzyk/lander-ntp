import { userEvent, waitFor, within } from 'storybook/test'

/** The title of the note on the page now, whether beside a thing or in the settings panel. */
const titleOf = (canvas: ReturnType<typeof within>) =>
  canvas.queryByRole('note')?.querySelector('strong')?.textContent ?? null

/**
 * For a story's `play`: answers the welcome with "Show me around", as a new install would, and
 * presses Next until the note's title is `stop`, so the story is shown at that stop of the guided
 * tour. The tour is page state and is never stored, so there is nothing to seed for it. With no
 * `stop`, it stops at the first one.
 */
export async function takeTour(canvasElement: HTMLElement, stop?: string) {
  const canvas = within(canvasElement)
  await userEvent.click(await canvas.findByRole('button', { name: 'Show me around' }))
  await canvas.findByRole('note')
  for (let presses = 0; stop !== undefined && titleOf(canvas) !== stop; presses += 1) {
    if (presses === 10) throw new Error(`The tour has no stop called "${stop}"`)
    const before = titleOf(canvas)
    await userEvent.click(
      within(await canvas.findByRole('note')).getByRole('button', { name: 'Next' }),
    )
    // The note fades before it acts and the next one fades in: wait for the new title.
    await waitFor(() => {
      const now = titleOf(canvas)
      if (now === null || now === before) throw new Error('The tour has not moved on yet')
    })
  }
  return canvas
}
