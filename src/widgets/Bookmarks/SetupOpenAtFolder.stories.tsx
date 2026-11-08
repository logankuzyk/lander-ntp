import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, within } from 'storybook/test'

import { withPage } from '../../../.storybook/withPage'
import { BookmarksOptionsStory } from './BookmarksOptionsStory'

const meta = {
  component: BookmarksOptionsStory,
  decorators: [withPage],
  title: 'Bookmarks/Setup/OpenAtFolder',
} satisfies Meta<typeof BookmarksOptionsStory>
export default meta
type Story = StoryObj<typeof meta>

export const OpenAtFolder: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Bookmarks, Choose a folder' }))
    const dialog = await canvas.findByRole('dialog', { name: 'Bookmarks options' })
    await expect(within(dialog).getByText('Folder')).toBeTruthy()
  },
}
