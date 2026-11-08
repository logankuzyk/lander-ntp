import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { AnalogClock } from './AnalogClock'
import { analogClockDefinition } from './definition'

const meta = {
  args: { face: 'ticks', showDate: false, showSeconds: true },
  component: AnalogClock,
  decorators: [withBox, withPage],
  parameters: { box: { col: 6, h: 2, row: 4, w: 2 } },
  title: 'Analog clock/Ready',
} satisfies Meta<typeof AnalogClock>
export default meta

type Story = StoryObj<typeof meta>

const rect = (w: number, h: number) => ({ col: Math.floor((12 - w) / 2) + 1, h, row: 2, w })
const sizeRect = (size: 'largest' | 'smallest' | 'starting') => {
  if (size === 'starting') return rect(2, 2)
  return rect(analogClockDefinition.sizes[size].w, analogClockDefinition.sizes[size].h)
}

/** A new Analog clock has Ticks and the Seconds hand on. */
export const Starting: Story = { parameters: { box: rect(2, 2) } }

/** The smallest Analog clock may be: 2 by 2. */
export const Smallest: Story = { parameters: { box: sizeRect('smallest') } }

/** The largest Analog clock may be: 6 by 6. */
export const Largest: Story = { parameters: { box: sizeRect('largest') } }

/** The crowded combination at the smallest size. */
export const EverythingOn: Story = {
  args: { face: 'numerals', showDate: true, showSeconds: true },
  parameters: { box: sizeRect('smallest') },
}

/** A round dial inside a wide box. */
export const WideBox: Story = { parameters: { box: rect(6, 2) } }

/** A round dial inside a tall box. */
export const TallBox: Story = { parameters: { box: rect(2, 6) } }

/** The seconds-hand tick has no animation under reduced motion. */
export const ReducedMotion: Story = {
  globals: { reducedMotion: 'reduce' },
  parameters: { box: sizeRect('starting') },
}
