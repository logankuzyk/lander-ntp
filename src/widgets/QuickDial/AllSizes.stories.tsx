import type { Meta, StoryObj } from '@storybook/preact-vite'

import { allWidgetSizes } from '../../../.storybook/widgetStories'
import { withPage } from '../../../.storybook/withPage'
import { quickDialDefinition } from './definition'
import { QuickDial } from './QuickDial'

const sizes = allWidgetSizes(quickDialDefinition.sizes)
const iconUrl = () =>
  'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>')

function AllSizesView() {
  return (
    <div
      style={{
        alignSelf: 'start',
        display: 'grid',
        gap: '0.75rem',
        gridTemplateColumns: 'repeat(3, 8rem)',
        padding: '1rem',
      }}
    >
      {sizes.map(({ h, w }) => (
        <div
          class="widget-box"
          key={`${w}x${h}`}
          style={{ height: `${h * 5}rem`, width: `${w * 5}rem` }}
        >
          <QuickDial
            iconUrl={iconUrl}
            label="Example site"
            newTab={false}
            url="https://example.com"
          />
        </div>
      ))}
    </div>
  )
}

const meta = { component: AllSizesView, decorators: [withPage], title: 'QuickDial' } satisfies Meta<
  typeof AllSizesView
>
export default meta
type Story = StoryObj<typeof meta>
export const AllSizes: Story = {}
