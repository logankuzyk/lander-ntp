import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { QuickDial } from './QuickDial'

const dataIcon = () =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#fff"/></svg>',
  )
const box = (w: number, h: number) => ({ col: 5, h, row: 4, w })

const meta = {
  args: {
    iconUrl: dataIcon,
    label: 'Example site',
    newTab: false,
    url: 'https://example.com',
  },
  component: QuickDial,
  decorators: [withBox, withPage],
  parameters: { box: box(1, 1) },
  title: 'QuickDial/Ready',
} satisfies Meta<typeof QuickDial>
export default meta

type Story = StoryObj<typeof meta>

export const Smallest: Story = { parameters: { box: box(1, 1) } }
export const Starting: Story = { parameters: { box: box(1, 1) } }
export const Largest: Story = { parameters: { box: box(3, 3) } }

/** Draws the selected synced icon instead of loading the site's favicon. */
export const Uploaded: Story = {
  args: { uploadedIcon: dataIcon() },
  parameters: { box: box(1, 1) },
}

export const UploadedSmallest: Story = {
  args: { uploadedIcon: dataIcon() },
  parameters: { box: box(1, 1) },
}
export const UploadedStarting: Story = {
  args: { uploadedIcon: dataIcon() },
  parameters: { box: box(1, 1) },
}
export const UploadedLargest: Story = {
  args: { uploadedIcon: dataIcon() },
  parameters: { box: box(3, 3) },
}
