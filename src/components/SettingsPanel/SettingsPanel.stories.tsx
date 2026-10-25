import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useEffect, useState } from 'preact/hooks'
import { fn } from 'storybook/test'

import { TOUR } from '@/onboarding/callouts'
import type { Settings } from '@/settings/schema'
import { makePlace, STORY_PHOTOS } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { SettingsPanel } from './SettingsPanel'

/**
 * Every setting written out, so neither the browser's locale nor a later change to the defaults
 * moves a story. Photos are cycling, the clock is on and the weather is off.
 */
const SETTINGS: Settings = {
  clock: { enabled: true, hour12: false, showDate: false, showSeconds: false },
  dim: true,
  font: 'system',
  photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
  v: 1,
  weather: {
    enabled: false,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: false },
      { id: 'sun', shown: false },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: null,
    unit: 'celsius',
  },
}

const weather = (changes: Partial<Settings['weather']>): Settings => ({
  ...SETTINGS,
  weather: { ...SETTINGS.weather, ...changes },
})

type Props = Parameters<typeof SettingsPanel>[0]

/**
 * The panel keeps nothing itself: the page owns the settings. Here a little state does, so
 * switches and choices respond in a published Storybook as they do on the page.
 */
function Stateful({ onChange, settings: initial, ...props }: Props) {
  const [settings, setSettings] = useState(initial)
  // Follow the Controls panel when it hands over new settings.
  useEffect(() => setSettings(initial), [initial])

  return (
    <SettingsPanel
      {...props}
      onChange={(next) => {
        setSettings(next)
        onChange(next)
      }}
      settings={settings}
    />
  )
}

const meta = {
  args: {
    currentId: STORY_PHOTOS[0]?.id ?? null,
    initialSection: 'photos',
    onChange: fn(),
    onClose: fn(),
    photos: STORY_PHOTOS,
    settings: SETTINGS,
  },
  component: SettingsPanel,
  decorators: [withPage],
  render: (args) => <Stateful {...args} />,
} satisfies Meta<typeof SettingsPanel>
export default meta

type Story = StoryObj<typeof meta>

export const PhotosCycling: Story = {}

export const PhotosKept: Story = {
  args: {
    settings: {
      ...SETTINGS,
      photos: { ...SETTINGS.photos, mode: 'pinned', pinnedId: STORY_PHOTOS[0]?.id ?? null },
    },
  },
}

export const ClockOn: Story = { args: { initialSection: 'clock' } }

export const ClockOff: Story = {
  args: {
    initialSection: 'clock',
    settings: { ...SETTINGS, clock: { ...SETTINGS.clock, enabled: false } },
  },
}

export const WeatherOff: Story = { args: { initialSection: 'weather' } }

export const WeatherOn: Story = {
  args: { initialSection: 'weather', settings: weather({ enabled: true, place: makePlace() }) },
}

/** On, with no place yet: the place search shows. */
export const WeatherChoosingAPlace: Story = {
  args: { initialSection: 'weather', settings: weather({ enabled: true, place: null }) },
}

export const General: Story = { args: { initialSection: 'general' } }

/**
 * Settings that a newer version of Lander wrote: the panel shows them and says to update, with
 * every control in the section off, and nothing is saved.
 */
export const FromNewerVersion: Story = {
  args: {
    readOnly: true,
    settings: {
      ...SETTINGS,
      photos: { ...SETTINGS.photos, mode: 'pinned', pinnedId: STORY_PHOTOS[0]?.id ?? null },
    },
  },
}

/** As a new install opens it: a note beside the panel for each section in turn. */
export const WithTheTour: Story = { args: { tour: TOUR } }
