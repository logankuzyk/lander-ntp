import type { Meta, StoryObj } from '@storybook/preact-vite'

import { COLS } from '@/layout/geometry'
import { WEATHER_FIELDS } from '@/settings/schema'
import { makePlace, makeWeather } from '@/test/fixtures'
import { defaultOptions } from '@/widgetSystem/options'

import { allWidgetSizes } from '../../../.storybook/widgetStories'
import { withPage } from '../../../.storybook/withPage'
import { weatherDefinition } from './definition'
import { Weather } from './Weather'

const allLines = {
  ...defaultOptions(weatherDefinition),
  fields: WEATHER_FIELDS.map((id) => ({ id, shown: true })),
}
const SIZES = [
  {
    fields: WEATHER_FIELDS.map((id) => ({ id, shown: false })),
    label: '1 by 1, no lines',
    size: { h: 1, w: 1 },
  },
  {
    fields: defaultOptions(weatherDefinition).fields,
    label: '1 by 1, one line',
    size: { h: 1, w: 1 },
  },
  ...allWidgetSizes(weatherDefinition.sizes, allLines).map((size) => ({
    fields: allLines.fields,
    label: `${size.w} by ${size.h}`,
    size,
  })),
]

/**
 * Every box a Weather may be given, in a stack, each as big as it would be on the Grid at this
 * window (the Grid's cell: 12 columns across the window less its 20px sides, 8 rows down it less
 * 16px above and 72px below), with every line on, the most it has to hold. Use the toolbar's
 * Viewport and Font menus to see it at each window and in each font.
 */
function SizesStack() {
  return (
    <div style={{ alignSelf: 'start', display: 'grid', gap: '0.75rem', padding: '1rem 0' }}>
      {SIZES.map(({ fields, label, size: { h, w } }, index) => (
        <div key={`${label}-${index}`}>
          <p style={{ fontSize: '0.75rem', margin: '0 0 0.25rem', opacity: 0.7 }}>{label}</p>
          <div
            class="widget-box"
            style={{
              height: `calc(${h} * (100vh - 88px) / 8)`,
              outline: '1px dashed rgb(255 255 255 / 50%)',
              width: `calc(${w} * (100vw - 40px) / ${COLS})`,
            }}
          >
            <Weather
              fields={fields}
              hour12={false}
              place={makePlace().name}
              weather={makeWeather()}
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
  title: 'Weather',
} satisfies Meta<typeof SizesStack>
export default meta

type Story = StoryObj<typeof meta>

export const AllSizes: Story = {}
