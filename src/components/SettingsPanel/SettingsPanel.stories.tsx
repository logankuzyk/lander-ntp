import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useEffect, useState } from 'preact/hooks'
import { fn, userEvent, within } from 'storybook/test'

import { favouritesItem } from '@/backdrop/favourites'
import { DEFAULT_BACKGROUND } from '@/backdrop/storage'
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
function Stateful({ onBackgroundChange, onChange, settings: initial, ...props }: Props) {
  const [settings, setSettings] = useState(initial)
  const [background, setBackground] = useState(props.background ?? DEFAULT_BACKGROUND)
  // Follow the Controls panel when it hands over new settings.
  useEffect(() => setSettings(initial), [initial])

  return (
    <SettingsPanel
      {...props}
      background={background}
      onBackgroundChange={(next) => {
        setBackground(next)
        onBackgroundChange?.(next)
      }}
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
    background: DEFAULT_BACKGROUND,
    currentId: STORY_PHOTOS[0]?.id ?? null,
    initialSection: 'photos',
    onBackgroundChange: fn(),
    onChange: fn(),
    onClose: fn(),
    onSelectPhoto: fn(),
    photos: STORY_PHOTOS,
    settings: SETTINGS,
  },
  component: SettingsPanel,
  decorators: [withPage],
  render: (args) => <Stateful {...args} />,
  title: 'SettingsPanel/Background',
} satisfies Meta<typeof SettingsPanel>
export default meta

type Story = StoryObj<typeof meta>

export const PhotosCycling: Story = {}

export const FavouritesOnlyOff: Story = {
  beforeEach: async () => {
    await favouritesItem.setValue({ ids: [STORY_PHOTOS[0]!.id], v: 1 })
  },
}

export const FavouritesOnlyOn: Story = {
  args: { background: { ...DEFAULT_BACKGROUND, favouritesOnly: true } },
  beforeEach: async () => {
    await favouritesItem.setValue({ ids: [STORY_PHOTOS[0]!.id], v: 1 })
  },
}

export const NoFavourites: Story = {
  beforeEach: async () => {
    await favouritesItem.setValue({ ids: [], v: 1 })
  },
}

export const FavouritesGone: Story = {
  args: {
    background: { ...DEFAULT_BACKGROUND, favouritesOnly: true },
    photos: STORY_PHOTOS.slice(1),
  },
  beforeEach: async () => {
    await favouritesItem.setValue({ ids: [STORY_PHOTOS[0]!.id], v: 1 })
  },
}

export const PhotoHeld: Story = {
  args: {
    settings: {
      ...SETTINGS,
      photos: { ...SETTINGS.photos, mode: 'pinned', pinnedId: STORY_PHOTOS[0]?.id ?? null },
    },
  },
  beforeEach: async () => {
    await favouritesItem.setValue({ ids: [STORY_PHOTOS[0]!.id], v: 1 })
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
    background: { ...DEFAULT_BACKGROUND, colour: '#123456', kind: 'colour' },
    backgroundReadOnly: true,
    settings: {
      ...SETTINGS,
      photos: { ...SETTINGS.photos, mode: 'pinned', pinnedId: STORY_PHOTOS[0]?.id ?? null },
    },
  },
}

export const Photo: Story = { args: { background: { ...DEFAULT_BACKGROUND, kind: 'photo' } } }

export const Colour: Story = { args: { background: { ...DEFAULT_BACKGROUND, kind: 'colour' } } }

export const ColourCustom: Story = {
  args: { background: { ...DEFAULT_BACKGROUND, colour: '#7357d6', kind: 'colour' } },
}

export const ColourHexError: Story = {
  args: { background: { ...DEFAULT_BACKGROUND, colour: '#7357d6', kind: 'colour' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const hex = await canvas.findByRole('textbox', { name: 'Hex colour' })
    await userEvent.clear(hex)
    await userEvent.type(hex, '12345g')
    await userEvent.keyboard('{Enter}')
  },
}

/**
 * The panel's own stops, counted alone. As the tour of a new install reaches them, after the
 * stops on the page, they are counted with those (see `Tour/Photos`).
 */
export const WithTheTour: Story = { args: { tour: SETTINGS_TOUR } }
