import type { Meta, StoryObj } from '@storybook/preact-vite'

import { allWidgetSizes } from '../../../.storybook/widgetStories'
import { withPage } from '../../../.storybook/withPage'
import { Date } from './Date'
import { dateDefinition } from './definition'

const sizes = allWidgetSizes(dateDefinition.sizes)

function SizesStack() {
  return (
    <div style={{ alignSelf: 'start', display: 'grid', gap: '0.75rem', padding: '1rem 0' }}>
      {sizes.map(({ h, w }) => (
        <div key={`${w}x${h}`}>
          <p style={{ fontSize: '0.75rem', margin: '0 0 0.25rem', opacity: 0.7 }}>
            {w} by {h}
          </p>
          <div
            class="widget-box"
            style={{
              height: `calc(${h} * (100vh - 88px) / 8)`,
              outline: '1px dashed rgb(255 255 255 / 50%)',
              width: `calc(${w} * (100vw - 40px) / 12)`,
            }}
          >
            <Date
              cells={{ h, w }}
              format="short"
              monthGrid
              showYear={false}
              weekNumbers={false}
              weekStartsOn="monday"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const meta = {
  component: SizesStack,
  decorators: [withPage],
  title: 'Date',
} satisfies Meta<typeof SizesStack>
export default meta
type Story = StoryObj<typeof meta>
export const AllSizes: Story = {}
