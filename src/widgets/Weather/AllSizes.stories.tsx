import type { Meta, StoryObj } from '@storybook/preact-vite'

import { COLS } from '@/layout/geometry'
import { WEATHER_FIELDS } from '@/settings/schema'
import { makePlace, makeWeather } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { weatherDefinition } from './definition'
import { Weather } from './Weather'

const { largest, smallest } = weatherDefinition.sizes

/** Every size from the smallest to the largest, in whole cells: 2 by 2, 3 by 2 ... 4 by 3. */
const SIZES = Array.from({ length: largest.h - smallest.h + 1 }, (_, dh) =>
  Array.from({ length: largest.w - smallest.w + 1 }, (_, dw) => ({
    h: smallest.h + dh,
    w: smallest.w + dw,
  })),
).flat()

/**
 * Every box a Weather may be given, in a stack, each as big as it would be on the Grid at this
 * window (the Grid's cell: 12 columns across the window less its 20px sides, 8 rows down it less
 * 16px above and 72px below), with every line on, the most it has to hold. Use the toolbar's
 * Viewport and Font menus to see it at each window and in each font.
 */
function SizesStack() {
  return (
    <div style={{ alignSelf: 'start', display: 'grid', gap: '0.75rem', padding: '1rem 0' }}>
      {SIZES.map(({ h, w }) => (
        <div key={`${w}x${h}`}>
          <p style={{ fontSize: '0.75rem', margin: '0 0 0.25rem', opacity: 0.7 }}>
            {w} by {h}
          </p>
          <div
            class="widget-box"
            style={{
              height: `calc(${h} * (100vh - 88px) / 8)`,
              outline: '1px dashed rgb(255 255 255 / 50%)',
              width: `calc(${w} * (100vw - 40px) / ${COLS})`,
            }}
          >
            <Weather
              fields={WEATHER_FIELDS.map((id) => ({ id, shown: true }))}
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
