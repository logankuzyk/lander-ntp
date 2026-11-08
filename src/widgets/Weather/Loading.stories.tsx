import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, stubRequests, weatherStateSeed } from '@/test/seed'

// The whole page with one Weather that has no reading yet, at each size the Weather may be:
// Smallest, Starting and Largest, in the top right corner. Its request never answers, so
// after a moment (about 400 ms) the box says it is loading, and keeps saying it. The seeds are
// in `weatherStateSeed`, where src/test/seed.test.tsx checks each draws what its story says.
// Look at them at 1440 by 900 and 1366 by 768 (the toolbar's Viewport menu).
const meta = { component: App, title: 'Weather/Loading' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The smallest box a Weather may have. */
export const Smallest: Story = {
  beforeEach: async () => {
    await seedPage(weatherStateSeed('loading', 'smallest'))
    return stubRequests('hang')
  },
}

/** The size a Weather starts at when added. */
export const Starting: Story = {
  beforeEach: async () => {
    await seedPage(weatherStateSeed('loading', 'starting'))
    return stubRequests('hang')
  },
}

/** The largest box a Weather may have. */
export const Largest: Story = {
  beforeEach: async () => {
    await seedPage(weatherStateSeed('loading', 'largest'))
    return stubRequests('hang')
  },
}
