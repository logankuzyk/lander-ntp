import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

// The whole page, as `App` stories are: no `withPage`. Each story seeds the storage it needs, and
// makes no request. The window is 1440 by 900; the toolbar's Viewport menu has 1366 by 768, the
// other size to look at. The seeds are in PAGE_SEEDS, where src/test/seed.test.tsx checks each
// draws what its story says.
const meta = {
  component: App,
  globals: { viewport: { isRotated: false, value: 'laptop1440' } },
  title: 'Grid',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/**
 * The seeded readings are fresh for 30 minutes. A story left open longer would ask Open-Meteo
 * for new ones: a request that never settles keeps the reading and sends nothing.
 */
function sendNothing() {
  const real = globalThis.fetch
  globalThis.fetch = () => new Promise<Response>(() => {})
  return () => {
    globalThis.fetch = real
  }
}

/** Nothing stored but the defaults: the Clock alone, in the middle (column 5, row 4, 4 by 2). */
export const NewInstall: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridNewInstall),
}

/**
 * Updated with the Clock and the Weather on: the Layout is worked out from the settings, the
 * Weather in the top right corner (column 11, row 1, 2 by 2) and the Clock where it was.
 */
export const UpdatedClockAndWeather: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
}

/** A Clock with seconds takes six columns, from column 4, so it stays in the middle. */
export const ClockWithSeconds: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridClockWithSeconds),
}

/** Both off: the Grid is there and empty, over the photo. */
export const Empty: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridEmpty),
}

/** Eight Widgets in a stored Layout: four Clocks and four Weathers. */
export const EightWidgets: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridEightWidgets)
    return sendNothing()
  },
}
