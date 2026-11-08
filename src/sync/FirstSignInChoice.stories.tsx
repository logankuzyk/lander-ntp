import type { Meta, StoryObj } from '@storybook/preact-vite'

import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { withPage } from '../../.storybook/withPage'
import { FirstSignInChoice } from './FirstSignInChoice'

const meta = {
  component: FirstSignInChoice,
  decorators: [withPage],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FirstSignInChoice>
export default meta

type Story = StoryObj<typeof meta>

/** The prompt stays over the page while the account choice is pending. */
export const OverThePage: Story = {
  args: { choose: () => {}, syncStatus: { needsChoice: true } },
  beforeEach: () => seedPage(PAGE_SEEDS.settledInstall),
}
