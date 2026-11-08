import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { seedPage } from '@/test/seed'

const meta = { component: App, title: 'QuickDial/Setup/ChooseSite' } satisfies Meta<typeof App>
export default meta
type Story = StoryObj<typeof meta>

async function seedSize(size: 'largest' | 'smallest' | 'starting') {
  const cells = size === 'largest' ? { h: 3, w: 3 } : { h: 1, w: 1 }
  await seedPage({
    layout: {
      v: 1,
      widgets: [
        {
          ...cells,
          col: 5,
          id: 'quickd01',
          options: { icon: null, label: '', newTab: false, url: '' },
          row: 4,
          type: 'quick-dial',
        },
      ],
    },
  })
}

export const Smallest: Story = { beforeEach: () => seedSize('smallest') }
export const Starting: Story = { beforeEach: () => seedSize('starting') }
export const Largest: Story = { beforeEach: () => seedSize('largest') }
