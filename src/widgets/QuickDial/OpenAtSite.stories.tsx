import type { Meta, StoryObj } from '@storybook/preact-vite'
import { userEvent, within } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { seedPage } from '@/test/seed'

const meta = { component: App, title: 'QuickDial/Setup/OpenAtSite' } satisfies Meta<typeof App>
export default meta
type Story = StoryObj<typeof meta>

export const OpenAtSite: Story = {
  beforeEach: async () => {
    await seedPage({
      layout: {
        v: 1,
        widgets: [
          {
            col: 5,
            h: 1,
            id: 'quickd01',
            options: { icon: null, label: '', newTab: false, url: '' },
            row: 4,
            type: 'quick-dial',
            w: 1,
          },
        ],
      },
    })
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: 'Quick dial, Choose a site' }),
    )
  },
}
