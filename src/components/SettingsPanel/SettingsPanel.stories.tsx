import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useEffect, useState } from 'preact/hooks'
import { fn } from 'storybook/test'

import { onboardingItem } from '@/onboarding/storage'
import { SETTINGS_TOUR } from '@/onboarding/tour'
import type { Settings } from '@/settings/schema'
import { STORY_PHOTOS } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { SettingsPanel } from './SettingsPanel'

/**
 * Every setting written out, so neither the browser's locale nor a later change to the defaults
 * moves a story. Photos are cycling. The clock and the weather are the page's, not the panel's:
 * their options are on the widgets, so the panel shows nothing of them whatever they are set to.
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

/** The font, and the line that points to Edit for the Clock's and the Weather's options. */
export const General: Story = { args: { initialSection: 'general' } }

/** An unseen Photos tab, with the mark recorded when the tab is opened. */
export const TabNew: Story = {
  args: { initialSection: 'general' },
  beforeEach: async () => {
    await onboardingItem.setValue({ dismissed: [], welcomed: true })
  },
}

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

/**
 * The panel's own stops, counted alone. As the tour of a new install reaches them, after the
 * stops on the page, they are counted with those (see `Tour/Photos`).
 */
export const WithTheTour: Story = { args: { tour: SETTINGS_TOUR } }
