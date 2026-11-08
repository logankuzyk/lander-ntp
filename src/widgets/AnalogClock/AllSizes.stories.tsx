import type { Meta, StoryObj } from '@storybook/preact-vite'

import { withPage } from '../../../.storybook/withPage'
import { AnalogClock } from './AnalogClock'

const meta = {
  args: { face: 'minimal', showDate: false, showSeconds: true },
  component: AnalogClock,
  decorators: [withPage],
  title: 'Analog clock',
} satisfies Meta<typeof AnalogClock>
export default meta

type Story = StoryObj<typeof meta>

function Sizes() {
  return (
    <div style={{ alignItems: 'center', display: 'flex', gap: '2rem' }}>
      {[2, 2, 6].map((cells, index) => (
        <div key={index} style={{ height: `${cells * 5}rem`, width: `${cells * 5}rem` }}>
          <AnalogClock face="minimal" showDate={false} showSeconds />
        </div>
      ))}
    </div>
  )
}

export const AllSizes: Story = {
  args: { face: 'minimal', showDate: false, showSeconds: true },
  render: () => <Sizes />,
}
