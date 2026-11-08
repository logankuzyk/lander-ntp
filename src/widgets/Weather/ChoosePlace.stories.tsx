import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, stubRequests, weatherSetupSeed } from '@/test/seed'

// The whole page with one Weather that has no place, at each size the Weather may be: Smallest,
// Starting and Largest, in the top right corner. The box says what it needs in one button,
// "Choose a place", and the page asks nobody. The seeds are in `weatherSetupSeed`, where
// src/test/seed.test.tsx checks each draws what its story says. Look at them at 1440 by 900 and
// 1366 by 768 (the toolbar's Viewport menu); the button must fit the smallest box whole.
const meta = { component: App, title: 'Weather/Setup/ChoosePlace' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The smallest box a Weather may have. */
export const Smallest: Story = {
  beforeEach: async () => {
    await seedPage(weatherSetupSeed('smallest'))
    return stubRequests('hang')
  },
}

/** The size a Weather starts at when added. */
export const Starting: Story = {
  beforeEach: async () => {
    await seedPage(weatherSetupSeed('starting'))
    return stubRequests('hang')
  },
}

/** The largest box a Weather may have. */
export const Largest: Story = {
  beforeEach: async () => {
    await seedPage(weatherSetupSeed('largest'))
    return stubRequests('hang')
  },
}
