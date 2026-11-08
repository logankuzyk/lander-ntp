import type { Meta, StoryObj } from '@storybook/preact-vite'
import { userEvent, within } from 'storybook/test'

import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

const meta = { component: App, title: 'Page/EveryWidget' } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

const page = (seed: (typeof PAGE_SEEDS)['everyWidgetOnPhoto']): Story => ({
  beforeEach: () => seedPage(seed),
})

/** Every Widget over a photo; switch between the two desktop windows in Viewport. */
export const OnPhoto: Story = page(PAGE_SEEDS.everyWidgetOnPhoto)

/** Every Widget over a dark colour, where the page uses light ink. */
export const OnDarkColour: Story = page(PAGE_SEEDS.everyWidgetOnDarkColour)

/** Every Widget over a light colour, where the page uses dark ink. */
export const OnLightColour: Story = page(PAGE_SEEDS.everyWidgetOnLightColour)

/** Every Widget in Edit mode over a light colour, including the dot grid and frames. */
export const EditingOnLightColour: Story = {
  ...page(PAGE_SEEDS.everyWidgetEditingOnLightColour),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Edit' }))
  },
}

/** All six Widget types at the Widget limit, shown in the phone viewport. */
export const AtTheLimit: Story = {
  ...page(PAGE_SEEDS.everyWidgetAtTheLimit),
  parameters: { viewport: { defaultViewport: 'phone390x780' } },
}
