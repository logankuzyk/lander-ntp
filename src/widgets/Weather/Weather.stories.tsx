import type { Meta, StoryObj } from '@storybook/preact-vite'

import { DEFAULT_SETTINGS, WEATHER_FIELDS } from '@/settings/schema'
import { makePlace, makeWeather } from '@/test/fixtures'
import { weatherBoxRect } from '@/test/seed'

import { withBox } from '../../../.storybook/withBox'
import { withPage } from '../../../.storybook/withPage'
import { Weather } from './Weather'

const fieldsWhere = (shown: boolean) => WEATHER_FIELDS.map((id) => ({ id, shown }))

const meta = {
  args: {
    // The lines a new Weather has on: the high and low.
    fields: DEFAULT_SETTINGS.weather.fields,
    hour12: false,
    place: makePlace().name,
    weather: makeWeather(),
  },
  component: Weather,
  decorators: [withBox, withPage],
  // The Weather is judged in its box, at the sizes its definition declares and in each of the
  // four fonts (the toolbar's Font menu), at 1440 by 900 and 1366 by 768 (the Viewport menu). The
  // box is the Grid's, in the top right corner where an update puts a Weather.
  parameters: { box: weatherBoxRect('starting') },
  title: 'Weather/Ready',
} satisfies Meta<typeof Weather>
export default meta

type Story = StoryObj<typeof meta>

/** The least room a Weather may have, with the lines a new one has on. */
export const Smallest: Story = { parameters: { box: weatherBoxRect('smallest') } }

/** Where a new Weather lands: 2 by 2, the same as its smallest. */
export const Starting: Story = {}

/** The most room a Weather may have. */
export const Largest: Story = { parameters: { box: weatherBoxRect('largest') } }

/** The most it must hold: every optional line on, in the least room a Weather may have. */
export const SmallestAllLines: Story = {
  args: { fields: fieldsWhere(true) },
  parameters: { box: weatherBoxRect('smallest') },
}

/** Every optional line on, where a new Weather lands. */
export const StartingAllLines: Story = { args: { fields: fieldsWhere(true) } }

/** Every optional line on, in the most room a Weather may have. */
export const LargestAllLines: Story = {
  args: { fields: fieldsWhere(true) },
  parameters: { box: weatherBoxRect('largest') },
}

/** The temperature and its icon alone: every optional line hidden. */
export const TemperatureOnly: Story = { args: { fields: fieldsWhere(false) } }

/** A longer place and a longer condition, the widest the lines get, in the least room. */
export const LongestLines: Story = {
  args: {
    fields: fieldsWhere(true),
    place: 'Saint-Jean-sur-Richelieu',
    weather: makeWeather({ code: 96, feelsLike: -12.2, temperature: -12.4 }),
  },
  parameters: { box: weatherBoxRect('smallest') },
}

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
