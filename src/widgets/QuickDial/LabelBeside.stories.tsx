import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { QuickDial } from './QuickDial'

const meta = {
  args: {
    iconUrl: () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    label: 'Example site',
    newTab: false,
    url: 'https://example.com',
  },
  component: QuickDial,
  decorators: [withBox, withPage],
  title: 'QuickDial/LabelBeside',
} satisfies Meta<typeof QuickDial>
export default meta
type Story = StoryObj<typeof meta>
export const TwoByOne: Story = { parameters: { box: { col: 5, h: 1, row: 4, w: 2 } } }
export const ThreeByTwo: Story = { parameters: { box: { col: 5, h: 2, row: 4, w: 3 } } }
