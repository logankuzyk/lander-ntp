import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { openOptions, startEditing } from '../../.storybook/startEditing'

// The whole page in edit mode with one Widget's options open, as a person gets there: the Edit
// button, then the Widget's Options button. Storage is seeded and no request is made. They fill
// the window; the toolbar's Viewport menu has 1440 by 900 and 1366 by 768, and the two stories
// that are about the window's size set their own.
const meta = {
  component: App,
  title: 'OptionsPopover',
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

/** The Clock in the middle: its three switches open to its right, the Clock in view. */
export const ClockBeside: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openOptions(canvas, 'Clock')
  },
}

/** A Weather with room to its right: all of its options, in one column, beside it. */
export const WeatherBeside: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.optionsWeatherBeside)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openOptions(canvas, 'Weather')
  },
}

/** A Weather at the right edge (where an update puts it): the popover flips to its left. */
export const WeatherFlipped: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openOptions(canvas, 'Weather')
  },
}

/**
 * A window shorter than the Weather's form, which is about 440 pixels tall (1366 by 400): the
 * popover takes the window's height and the options scroll inside it, under the header.
 */
export const ShortWindow: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.optionsWeatherBeside)
    return sendNothing()
  },
  globals: { viewport: { isRotated: false, value: 'short1366' } },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openOptions(canvas, 'Weather')
  },
}

/**
 * A phone-sized window (390 by 800), where neither side of a widget has the width for the
 * popover: it opens below the Weather, or above it, whichever has the room.
 */
export const NarrowWindow: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.optionsWeatherBeside)
    return sendNothing()
  },
  globals: { viewport: { isRotated: false, value: 'phone390' } },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openOptions(canvas, 'Weather')
  },
}
