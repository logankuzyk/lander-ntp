import type { Meta, StoryObj } from '@storybook/preact-vite'

import { WEATHER_FIELDS } from '@/settings/schema'
import { makePlace, makeWeather } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { Weather } from './Weather'

const fieldsWhere = (shown: boolean) => WEATHER_FIELDS.map((id) => ({ id, shown }))

const meta = {
  args: {
    fields: fieldsWhere(true),
    hour12: false,
    place: makePlace().name,
    weather: makeWeather(),
  },
  component: Weather,
  decorators: [withPage],
} satisfies Meta<typeof Weather>
export default meta

type Story = StoryObj<typeof meta>

/** Every optional line switched on, in the order the widget draws them. */
export const EveryFieldShown: Story = {}

/** The temperature and its icon alone: every optional line hidden. */
export const TemperatureOnly: Story = { args: { fields: fieldsWhere(false) } }

/** A different icon, for snow after dark. */
export const SnowAtNight: Story = {
  args: {
    weather: makeWeather({
      code: 73,
      feelsLike: -7.1,
      high: 0.4,
      isDay: false,
      low: -4.6,
      temperature: -3.2,
    }),
  },
}
