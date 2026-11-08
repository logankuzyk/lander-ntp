import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, within } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

const meta = {
  component: App,
  title: 'Update',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

async function seedUpdate() {
  await seedPage(PAGE_SEEDS.layoutNewsClockOnly)
  await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })
  const realFetch = globalThis.fetch
  globalThis.fetch = () => new Promise<Response>(() => {})
  return () => {
    globalThis.fetch = realFetch
  }
}

/** The Add menu open on the first stop, with the four new Widgets marked New. */
export const WidgetsInAdd: Story = {
  beforeEach: seedUpdate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show me' }))
    await expect(canvas.getByRole('menu', { name: 'Add a widget' })).toBeInTheDocument()
  },
}

/** The same stop at the Widget limit: Add still opens and explains why every Widget is unavailable. */
export const WidgetsAtLimit: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.addMenuAtLimit)
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })
    const realFetch = globalThis.fetch
    globalThis.fetch = () => new Promise<Response>(() => {})
    return () => {
      globalThis.fetch = realFetch
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show me' }))
    await expect(canvas.getByRole('menu', { name: 'Add a widget' })).toBeInTheDocument()
    await expect(
      canvas.getByText("That's all 8 widgets. Remove one to add another."),
    ).toBeInTheDocument()
  },
}

/** Photo details open quietly on the second stop, with the favourite heart marked New. */
export const Heart: Story = {
  beforeEach: seedUpdate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show me' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }))
    await expect(canvas.getByRole('dialog', { name: 'Photo details' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Favourite' })).toBeInTheDocument()
  },
}

/** The Background tab open on the third stop. */
export const Background: Story = {
  beforeEach: seedUpdate,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Show me' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }))
    await expect(canvas.getByRole('tab', { name: /Background/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  },
}
