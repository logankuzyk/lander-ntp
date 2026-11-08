import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, stubRequests, type WeatherBoxSize, weatherSetupSeed } from '@/test/seed'

import { locationNotAllowed } from '../../../.storybook/browserStubs'

// The whole page with one Weather that follows the device, where the browser has not yet allowed
// this page to read the device's location, at each size the Weather may be: Smallest, Starting
// and Largest, in the top right corner. The box says what it needs in one button, "Allow
// location", and the page asks nobody and fetches nothing. (The browser is made to say the
// permission is still to be asked: see `locationNotAllowed`. Pressing the button here shows the
// browser's own prompt.) The seeds are in `weatherSetupSeed`, where src/test/seed.test.tsx checks
// each draws what its story says. Look at them at 1440 by 900 and 1366 by 768 (the toolbar's
// Viewport menu); the button must fit the smallest box whole.
const meta = {
  component: App,
  title: 'Weather/Setup/AllowLocation',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** Seeds the page, and has the browser not yet allow the location; returns what puts it back. */
const withoutLocation = (size: WeatherBoxSize) => async () => {
  await seedPage(weatherSetupSeed(size, 'location'))
  const restoreLocation = locationNotAllowed()
  const restoreRequests = stubRequests('hang')
  return () => {
    restoreRequests()
    restoreLocation()
  }
}

/** The smallest box a Weather may have. */
export const Smallest: Story = { beforeEach: withoutLocation('smallest') }

/** The size a Weather starts at when added. */
export const Starting: Story = { beforeEach: withoutLocation('starting') }

/** The largest box a Weather may have. */
export const Largest: Story = { beforeEach: withoutLocation('largest') }
