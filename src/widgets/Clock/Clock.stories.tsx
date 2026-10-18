import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withPage } from '../../../.storybook/withPage'
import { Clock } from './Clock'

const meta = {
  args: { hour12: false, showDate: false, showSeconds: false },
  component: Clock,
  decorators: [withPage],
} satisfies Meta<typeof Clock>
export default meta

type Story = StoryObj<typeof meta>

export const TwentyFourHour: Story = {}

export const TwelveHour: Story = { args: { hour12: true } }

export const WithTheDate: Story = { args: { showDate: true } }

export const WithSeconds: Story = { args: { showSeconds: true } }
