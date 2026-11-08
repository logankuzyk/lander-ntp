import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, weatherStateSeed } from '@/test/seed'

// The whole page with one Weather whose source the photo manifest has switched off, at each
// size the Weather may be: Smallest, Starting and Largest, in the top right corner. The box
// says it is switched off at once. Nothing is asked of the network, so there is nothing to
// stub. The seeds are in `weatherStateSeed`, where src/test/seed.test.tsx checks each draws
// what its story says. Look at them at 1440 by 900 and 1366 by 768 (the toolbar's Viewport menu).
const meta = { component: App, title: 'Weather/Off' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The smallest box a Weather may have. */
export const Smallest: Story = {
  beforeEach: () => seedPage(weatherStateSeed('off', 'smallest')),
}

/** The size a Weather starts at when added. */
export const Starting: Story = {
  beforeEach: () => seedPage(weatherStateSeed('off', 'starting')),
}

/** The largest box a Weather may have. */
export const Largest: Story = {
  beforeEach: () => seedPage(weatherStateSeed('off', 'largest')),
}
