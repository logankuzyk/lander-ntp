import type { Meta, StoryObj } from '@storybook/preact-vite'

import type { Rect } from '@/layout/geometry'
import { defaultOptions } from '@/widgetSystem/options'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { Clock } from './Clock'
import { clockDefinition } from './definition'

const { largest, smallest, starting } = clockDefinition.sizes

/** The box a size takes on the Grid, centred as far as whole cells allow (12 by 8). */
const centred = ({ h, w }: { h: number; w: number }): Rect => ({
  col: 1 + Math.floor((12 - w) / 2),
  h,
  row: 1 + Math.floor((8 - h) / 2),
  w,
})

const startingSize = starting(defaultOptions(clockDefinition))

// The Clock is judged in its box, at the sizes the definition declares and in each of the four
// fonts (the toolbar's Font menu), at 1440 by 900 and 1366 by 768 (the Viewport menu). The box is
// the Grid's, so what the story fills is what the page gives a Clock of that size.
const meta = {
  args: { hour12: false, showDate: false, showSeconds: false },
  component: Clock,
  decorators: [withBox, withPage],
  parameters: { box: centred(startingSize) },
  title: 'Clock/Ready',
} satisfies Meta<typeof Clock>
export default meta

type Story = StoryObj<typeof meta>

/** The most it must hold: seconds and the date, in the least room a Clock may have. */
export const Smallest: Story = {
  args: { showDate: true, showSeconds: true },
  parameters: { box: centred(smallest) },
}

/** Where a new Clock lands: 4 by 2, in the middle. The page's own Clock until it is resized. */
export const Starting: Story = {}

/** The most room a Clock may have, with seconds and the date. */
export const Largest: Story = {
  args: { showDate: true, showSeconds: true },
  parameters: { box: centred(largest) },
}

// The options, at the size a Clock with them starts at.

export const TwentyFourHour: Story = {}

export const TwelveHour: Story = { args: { hour12: true } }

export const WithTheDate: Story = { args: { showDate: true } }

/** In the box the page gives a Clock with seconds: 6 columns wide, from column 4. */
export const WithSeconds: Story = {
  args: { showSeconds: true },
  parameters: { box: centred(starting({ showDate: false, showSeconds: true })) },
}
