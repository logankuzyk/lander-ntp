import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { QuickDial } from './QuickDial'

const meta = {
  args: {
    iconUrl: () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    label: 'A longer example site name that will be cut short',
    newTab: false,
    url: 'https://example.com',
  },
  component: QuickDial,
  decorators: [withBox, withPage],
  parameters: { box: { col: 5, h: 2, row: 4, w: 3 } },
  title: 'QuickDial/LongLabel',
} satisfies Meta<typeof QuickDial>
export default meta
type Story = StoryObj<typeof meta>
export const LongLabel: Story = {}
