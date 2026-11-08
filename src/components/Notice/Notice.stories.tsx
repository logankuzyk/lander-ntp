import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withPage } from '../../../.storybook/withPage'
import { Notice } from './Notice'

// The notice is fixed above the bottom bar, so it sits low on the left of the story's canvas.
const meta = {
  args: { message: "Couldn't save that. Try again in a minute.", onDismiss: () => {} },
  component: Notice,
  decorators: [withPage],
} satisfies Meta<typeof Notice>
export default meta

type Story = StoryObj<typeof meta>

/** What the page says when the browser refuses a change, and has put the old value back. */
export const SaveFailed: Story = {}
