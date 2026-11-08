import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, within } from 'storybook/test'

import { withPage } from '../../../.storybook/withPage'
import { BookmarksOptionsStory } from './BookmarksOptionsStory'

const meta = {
  component: BookmarksOptionsStory,
  decorators: [withPage],
  title: 'OptionsPopover/Bookmarks',
} satisfies Meta<typeof BookmarksOptionsStory>
export default meta
type Story = StoryObj<typeof meta>

export const Folder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Bookmarks, Choose a folder' }))
    await expect(canvas.findByRole('dialog', { name: 'Bookmarks options' })).resolves.toBeTruthy()
  },
}
