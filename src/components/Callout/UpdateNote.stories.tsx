import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

// The note an update from v0.2.3 shows once, at the Edit button: the real `NEWS` entry, drawn by
// the whole page (`App`) over a seeded state that was welcomed long ago with nothing dismissed.
// Storage is seeded and no request is made. They fill the window; the toolbar's Viewport menu has
// 1440 by 900, 1366 by 768 and a phone's 390 by 800. The words are the owner's call (LR-108).
const meta = {
  component: App,
  title: 'Callout/UpdateNote',
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

/** The Clock in the middle and the Weather in the top right corner, as v0.2.3 had them. */
export const ClockAndWeather: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
    return sendNothing()
  },
}

/** The Clock alone, the way a new install starts. */
export const ClockOnly: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockOnly)
    return sendNothing()
  },
}

/** The Clock off and a Weather with no place yet: its setup button, and no Clock. */
export const WeatherOnly: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsWeatherOnly)
    return sendNothing()
  },
}

/**
 * Both off: an empty Grid over the photo, as before. The note is the same one, and says Add
 * brings widgets back.
 */
export const BothOff: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsBothOff)
    return sendNothing()
  },
}

/** After "Show me": the first walk stop is beside Edit and the page has not changed. */
export const WalkFirstStop: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show me' }))
    await expect(canvas.getByText('Edit your page')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Done' })).not.toBeInTheDocument()
  },
}

/**
 * A new install, after the welcome is skipped: no note. The install records the note as already
 * seen, since the tour covers the same ground.
 */
export const NewInstallNoNote: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.newInstall),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.queryByRole('note')).toBeNull()
  },
}
