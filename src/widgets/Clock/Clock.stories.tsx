import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { Clock } from './Clock'

const meta = {
  args: { hour12: false, showDate: false, showSeconds: false },
  component: Clock,
  decorators: [withBox, withPage],
  // Where the page puts a Clock: the middle, 4 by 2 (the default of withBox).
} satisfies Meta<typeof Clock>
export default meta

type Story = StoryObj<typeof meta>

export const TwentyFourHour: Story = {}

export const TwelveHour: Story = { args: { hour12: true } }

export const WithTheDate: Story = { args: { showDate: true } }

/** In the box the page gives a Clock with seconds: 6 columns wide, from column 4. */
export const WithSeconds: Story = {
  args: { showSeconds: true },
  parameters: { box: { col: 4, h: 2, row: 4, w: 6 } },
}
