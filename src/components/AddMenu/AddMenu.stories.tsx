import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { addFromMenu, openAddMenu, startEditing } from '../../../.storybook/startEditing'

// The whole page in edit mode with the Add menu open, as a person gets there: the Edit button,
// then Add. Storage is seeded and no request is made. They fill the window; the toolbar's
// Viewport menu has 1440 by 900 and 1366 by 768, and a narrow one is a custom size.
const meta = {
  component: App,
  title: 'AddMenu',
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

/** A new install (the Clock alone, in the middle): the menu above the Add button, both items there. */
export const Open: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.addMenuOpen),
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openAddMenu(canvas)
  },
}

/** No cell is free, so neither item can be picked: each says why, and can still be reached. */
export const NoRoom: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.addMenuNoRoom),
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openAddMenu(canvas)
  },
}

/**
 * An update that had the Weather off but set up for Victoria: picking Weather from the menu adds
 * one that starts from those kept options, so it shows Victoria's forecast and not a setup button.
 */
export const WaitingOptions: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.addMenuWaitingOptions)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openAddMenu(canvas)
    await addFromMenu(canvas, 'Weather')
  },
}

/**
 * A new install adds a Weather: it lands next to the Clock with its setup button, the frame has
 * focus, and nothing opens by itself.
 */
export const AddedWeather: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.addMenuOpen),
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openAddMenu(canvas)
    await addFromMenu(canvas, 'Weather')
  },
}

/** An update with the Clock and the Weather off: an empty Grid, and a Clock added from the menu. */
export const EmptyGrid: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridEmpty),
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await openAddMenu(canvas)
    await addFromMenu(canvas, 'Clock')
  },
}
