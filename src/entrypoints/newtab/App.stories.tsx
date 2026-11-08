import type { Meta, StoryObj } from '@storybook/preact-vite'
import { userEvent, within } from 'storybook/test'

import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

// No `withPage`: App draws its own wrapper and sets the font from the stored settings. Each story
// seeds the storage it needs, after the preview has cleared it (see .storybook/preview.tsx). The
// seeds are in PAGE_SEEDS, where src/test/seed.test.tsx checks each draws what its story says.
const meta = { component: App, title: 'Page' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The first tab after installing: the welcome, over the photo. */
export const NewInstall: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.newInstall),
}

/** Someone using it day to day, with the settings as they come. */
export const SettledInstall: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.settledInstall),
}

/** Weather switched on with a place, showing a reading with no request made for it. */
export const WeatherOn: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.weatherOn)
    // The seeded reading is fresh for 30 minutes. A story left open longer would ask Open-Meteo
    // for a new one, and would drop the seeded reading after 3 hours of failing to get one. A
    // request that never settles keeps the reading and sends nothing.
    const real = globalThis.fetch
    globalThis.fetch = () => new Promise<Response>(() => {})
    return () => {
      globalThis.fetch = real
    }
  },
}

const colourStory = (seed: (typeof PAGE_SEEDS)['colourDark']): Story => ({
  beforeEach: () => seedPage(seed),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Edit' }))
  },
})

/** Clock and Weather over the darkest preset, with the Grid in Edit mode. */
export const ColourDark: Story = colourStory(PAGE_SEEDS.colourDark)

/** Clock and Weather over a mid colour, with the Grid in Edit mode. */
export const ColourMid: Story = colourStory(PAGE_SEEDS.colourMid)

/** Clock and Weather over a light colour; the dot grid stays readable in Edit mode. */
export const ColourLight: Story = colourStory(PAGE_SEEDS.colourLight)

/** The settings panel keeps its own dark panel and white text over a light colour. */
export const ColourWithSettingsOpen: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.colourWithSettingsOpen),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Settings' }))
  },
}
