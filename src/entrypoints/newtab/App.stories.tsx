import type { Meta, StoryObj } from '@storybook/preact-vite'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { makePlace, makeWeather } from '@/test/fixtures'
import { seedPage } from '@/test/seed'

import { App } from './App'

// No `withPage`: App draws its own wrapper and sets the font from the stored settings. Each story
// seeds the storage it needs, after the preview has cleared it (see .storybook/preview.tsx).
const meta = { component: App } satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** The first tab after installing: the welcome, over the photo. */
export const NewInstall: Story = {
  beforeEach: () => seedPage({ pending: { dismissed: ['weather'], welcomed: false } }),
}

/** Someone using it day to day, with the settings as they come. */
export const SettledInstall: Story = {
  beforeEach: () => seedPage({ onboarding: { dismissed: ['weather'], welcomed: true } }),
}

/** Weather switched on with a place, showing a reading with no request made for it. */
export const WeatherOn: Story = {
  beforeEach: () =>
    seedPage({
      onboarding: { dismissed: ['weather'], welcomed: true },
      settings: {
        ...DEFAULT_SETTINGS,
        weather: {
          ...DEFAULT_SETTINGS.weather,
          enabled: true,
          place: makePlace(),
          unit: 'celsius',
        },
      },
      weather: makeWeather(),
    }),
}

/** Someone who had the extension before the weather arrived, and is told about it. */
export const WeatherNews: Story = {
  beforeEach: () => seedPage({ onboarding: { dismissed: [], welcomed: true } }),
}
