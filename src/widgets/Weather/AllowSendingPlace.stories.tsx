import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage, stubRequests, type WeatherBoxSize, weatherSetupSeed } from '@/test/seed'

import { asFirefox } from '../../../.storybook/browserStubs'

// The whole page with one Weather that has a place, on Firefox, where the user has not yet
// agreed to send it to the forecast service, at each size the Weather may be: Smallest, Starting
// and Largest, in the top right corner. The box says what it needs in one button, "Allow sending
// your place", and the page asks nobody and fetches nothing. (The stories play Firefox: see
// `asFirefox`. Pressing the button here records the agreement and the Weather goes on to load.)
// The seeds are in `weatherSetupSeed`, where src/test/seed.test.tsx checks each draws what its
// story says. Look at them at 1440 by 900 and 1366 by 768 (the toolbar's Viewport menu); the
// button must fit the smallest box whole.
const meta = {
  component: App,
  title: 'Weather/Setup/AllowSendingPlace',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** Seeds the page, and makes it Firefox with no agreement; returns what puts both back. */
const withoutAgreement = (size: WeatherBoxSize) => async () => {
  await seedPage(weatherSetupSeed(size, 'consent'))
  const restoreBrowser = asFirefox({ consented: false })
  const restoreRequests = stubRequests('hang')
  return () => {
    restoreRequests()
    restoreBrowser()
  }
}

/** The smallest box a Weather may have. */
export const Smallest: Story = { beforeEach: withoutAgreement('smallest') }

/** The size a Weather starts at when added. */
export const Starting: Story = { beforeEach: withoutAgreement('starting') }

/** The largest box a Weather may have. */
export const Largest: Story = { beforeEach: withoutAgreement('largest') }
