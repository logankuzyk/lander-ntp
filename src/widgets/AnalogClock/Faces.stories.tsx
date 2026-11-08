import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { AnalogClock } from './AnalogClock'

const meta = {
  component: AnalogClock,
  decorators: [withBox, withPage],
  title: 'Analog clock/Ready/Faces',
} satisfies Meta<typeof AnalogClock>
export default meta
type Story = StoryObj<typeof meta>

const story = (face: 'minimal' | 'numerals' | 'ticks', w: number, h: number): Story => ({
  args: { face, showDate: false, showSeconds: true },
  parameters: { box: { col: Math.floor((12 - w) / 2) + 1, h, row: 2, w } },
})

export const MinimalSmallest: Story = {
  ...story('minimal', 2, 2),
  name: 'Minimal / Smallest',
  parameters: { box: { col: 6, h: 2, row: 4, w: 2 } },
}
export const MinimalStarting: Story = { ...story('minimal', 2, 2), name: 'Minimal / Starting' }
export const MinimalLargest: Story = { ...story('minimal', 6, 6), name: 'Minimal / Largest' }
export const NumeralsSmallest: Story = { ...story('numerals', 2, 2), name: 'Numerals / Smallest' }
export const NumeralsStarting: Story = { ...story('numerals', 2, 2), name: 'Numerals / Starting' }
export const NumeralsLargest: Story = { ...story('numerals', 6, 6), name: 'Numerals / Largest' }
