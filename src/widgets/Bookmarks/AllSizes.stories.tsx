import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withPage } from '../../../.storybook/withPage'
import { BookmarksStory } from './BookmarksStory'

const meta = {
  component: BookmarksStory,
  decorators: [withPage],
  title: 'Bookmarks',
} satisfies Meta<typeof BookmarksStory>
export default meta
type Story = StoryObj<typeof meta>

export const AllSizes: Story = {
  args: { cells: { h: 8, w: 6 }, mode: 'ready' },
}
