import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, within } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

const meta = {
  component: App,
  title: 'Callout/PhaseThreeNote',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The Widgets and backgrounds update note, after the earlier Layout note was dismissed. */
export const Note: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockOnly)
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })
    const realFetch = globalThis.fetch
    globalThis.fetch = () => new Promise<Response>(() => {})
    return () => {
      globalThis.fetch = realFetch
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('New: widgets and backgrounds')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Show me' }))
    await expect(canvas.getByText('Four new Widgets')).toBeInTheDocument()
  },
}
