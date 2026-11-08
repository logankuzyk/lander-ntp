import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { QuickDial } from './QuickDial'

const meta = {
  args: {
    iconUrl: () => 'data:image/gif;base64,not-base64',
    label: 'Example site',
    newTab: false,
    url: 'https://example.com',
  },
  component: QuickDial,
  decorators: [withBox, withPage],
  title: 'QuickDial/Letter',
} satisfies Meta<typeof QuickDial>
export default meta
type Story = StoryObj<typeof meta>
export const Letter: Story = {}
