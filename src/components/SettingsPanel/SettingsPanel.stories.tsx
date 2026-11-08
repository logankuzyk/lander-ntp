import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useEffect, useState } from 'preact/hooks'
import { fn } from 'storybook/test'

import { TOUR } from '@/onboarding/callouts'
import type { Settings } from '@/settings/schema'
import { makeAccount, makePlace, STORY_PHOTOS } from '@/test/fixtures'
import { seedPage } from '@/test/seed'

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
  beforeEach: async () => {
    await seedPage({})
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

/** As a new install opens it: a note beside the panel for each section in turn. */
export const WithTheTour: Story = { args: { tour: TOUR } }

export const AccountSignedOut: Story = { args: { initialSection: 'account' } }

export const AccountCodeSent: Story = {
  args: { accountPreview: { codeSent: true }, initialSection: 'account' },
}

export const AccountWrongCode: Story = {
  args: { accountPreview: { codeSent: true, error: 'wrong-code' }, initialSection: 'account' },
}

export const AccountSignedIn: Story = {
  args: {
    accountPreview: { state: makeAccount({ devices: [storyDevice('one', true)] }) },
    initialSection: 'account',
  },
}

export const AccountTwoDevices: Story = {
  args: {
    accountPreview: {
      state: makeAccount({ devices: [storyDevice('one', true), storyDevice('two')] }),
    },
    initialSection: 'account',
  },
}

export const AccountThreeDevices: Story = {
  args: {
    accountPreview: {
      state: makeAccount({
        devices: [storyDevice('one', true), storyDevice('two'), storyDevice('three')],
      }),
    },
    initialSection: 'account',
  },
}

export const AccountPendingDevice: Story = {
  args: {
    accountPreview: {
      state: {
        devices: [storyDevice('one'), storyDevice('two'), storyDevice('three')],
        email: 'person@example.com',
        notice: 'none',
        status: 'pending-device',
      },
    },
    initialSection: 'account',
  },
}

export const AccountDeleteConfirm: Story = {
  args: {
    accountPreview: {
      deleteOpen: true,
      state: makeAccount({ devices: [storyDevice('one', true)] }),
    },
    initialSection: 'account',
  },
}

export const AccountDeleteFailed: Story = {
  args: {
    accountPreview: {
      deleteOpen: true,
      error: 'network-error',
      state: makeAccount({ devices: [storyDevice('one', true)] }),
    },
    initialSection: 'account',
  },
}

export const AccountNeverSynced: Story = {
  args: {
    accountPreview: { state: makeAccount({ devices: [storyDevice('one', true)] }) },
    initialSection: 'account',
  },
}

export const AccountSignedOutElsewhere: Story = {
  args: {
    accountPreview: { state: { notice: 'signed-out-elsewhere', status: 'signed-out' } },
    initialSection: 'account',
  },
}

export const AccountPaused: Story = {
  args: {
    accountPreview: { state: { notice: 'paused-no-consent', status: 'signed-out' } },
    initialSection: 'account',
  },
}

export const AccountConsentRefused: Story = {
  args: { accountPreview: { error: 'consent-refused' }, initialSection: 'account' },
}

function storyDevice(id: string, current = false) {
  return {
    browser: id === 'one' ? 'Firefox' : 'Chrome',
    createdAt: '2026-10-01T00:00:00.000Z',
    current,
    id,
    lastUsedAt: '2026-10-17T00:00:00.000Z',
    os: id === 'one' ? 'Windows' : 'macOS',
  }
}
