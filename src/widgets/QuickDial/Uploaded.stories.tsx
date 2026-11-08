import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { QuickDial } from './QuickDial'

const icon =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#fff"/></svg>',
  )
const box = (w: number, h: number) => ({ col: 5, h, row: 4, w })

const meta = {
  args: { label: 'Example site', newTab: false, uploadedIcon: icon, url: 'https://example.com' },
  component: QuickDial,
  decorators: [withBox, withPage],
  parameters: { box: box(1, 1) },
  title: 'QuickDial/Ready/Uploaded',
} satisfies Meta<typeof QuickDial>
export default meta

type Story = StoryObj<typeof meta>

export const Smallest: Story = { parameters: { box: box(1, 1) } }
export const Starting: Story = { parameters: { box: box(1, 1) } }
export const Largest: Story = { parameters: { box: box(3, 3) } }
