import type { Meta, StoryObj } from '@storybook/preact-vite'
import { userEvent, within } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, stubRequests, weatherSetupSeed } from '@/test/seed'

// The page as it is a moment after the setup button is pressed, outside edit mode: the Weather's
// options open beside it with the place search focused (and its suggestions closed). Storage is
// seeded and nothing is requested. Look at it at 1440 by 900 and 1366 by 768.
const meta = { component: App, title: 'Weather/Setup/OpenAtPlace' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** A Weather at its starting size with no place, its options open at the place search. */
export const Open: Story = {
  beforeEach: async () => {
    await seedPage(weatherSetupSeed('starting'))
    return stubRequests('hang')
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Weather, Choose a place' }))
  },
}
