import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withPage } from '../../../.storybook/withPage'
import { BookmarksStory } from './BookmarksStory'

const meta = {
  args: { cells: { h: 3, w: 2 }, mode: 'failed' },
  component: BookmarksStory,
  decorators: [withPage],
  title: 'Bookmarks/Failed',
} satisfies Meta<typeof BookmarksStory>
export default meta
type Story = StoryObj<typeof meta>
export const Smallest: Story = { args: { cells: { h: 2, w: 2 }, mode: 'failed' } }
export const Starting: Story = {}
export const Largest: Story = { args: { cells: { h: 8, w: 6 }, mode: 'failed' } }
