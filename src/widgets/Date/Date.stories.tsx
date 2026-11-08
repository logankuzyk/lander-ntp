import type { Meta, StoryObj } from '@storybook/preact-vite'

import type { Rect } from '@/layout/geometry'
import { defaultOptions } from '@/widgetSystem/options'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { Date } from './Date'
import { dateDefinition } from './definition'

const { largest, smallest, starting } = dateDefinition.sizes
const centred = ({ h, w }: { h: number; w: number }): Rect => ({
  col: 1 + Math.floor((12 - w) / 2),
  h,
  row: 1 + Math.floor((8 - h) / 2),
  w,
})
const base = defaultOptions(dateDefinition)
const meta = {
  args: { cells: starting(base), ...base, locale: 'en-US' },
  component: Date,
  decorators: [withBox, withPage],
  parameters: { box: centred(starting(base)) },
  title: 'Date/Ready',
} satisfies Meta<typeof Date>
export default meta

type Story = StoryObj<typeof meta>

export const Smallest: Story = {
  args: { ...meta.args, cells: smallest },
  parameters: { box: centred(smallest) },
}
export const Starting: Story = {}
export const Largest: Story = {
  args: { ...meta.args, cells: largest },
  parameters: { box: centred(largest) },
}

export const LongWithYear: Story = {
  args: { ...meta.args, cells: smallest, format: 'long', showYear: true },
  parameters: { box: centred(smallest) },
}
export const GridOff: Story = {
  args: { ...meta.args, cells: { h: 3, w: 3 }, monthGrid: false },
  parameters: { box: centred({ h: 3, w: 3 }) },
}
export const WeekStrip: Story = {
  args: { ...meta.args, cells: { h: 1, w: 5 } },
  decorators: [withPage],
  render: (args) => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        class="widget-box"
        style={{ height: 'calc((100vh - 88px) / 8)', width: 'calc(5 * (100vw - 40px) / 12)' }}
      >
        <Date {...args} />
      </div>
      <div
        class="widget-box"
        style={{ height: 'calc(2 * (100vh - 88px) / 8)', width: 'calc(5 * (100vw - 40px) / 12)' }}
      >
        <Date {...args} cells={{ h: 2, w: 5 }} />
      </div>
    </div>
  ),
}
export const MonthWeekNumbers: Story = {
  args: { ...meta.args, cells: largest, weekNumbers: true },
  parameters: { box: centred(largest) },
}
export const SundayStart: Story = {
  args: { ...meta.args, cells: largest, weekStartsOn: 'sunday' },
  parameters: { box: centred(largest) },
}
export const SixWeekMonth: Story = {
  args: { ...meta.args, cells: largest, simulatedToday: new globalThis.Date(2026, 7, 1, 12) },
  parameters: { box: centred(largest) },
}
