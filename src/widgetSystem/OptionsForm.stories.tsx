import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import type { Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { makePlace } from '@/test/fixtures'
import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import { withPage } from '../../.storybook/withPage'
import { withPanel } from '../../.storybook/withPanel'
import { pageValues, widgetsFromSettings } from './fromSettings'
import { OptionsForm } from './OptionsForm'

/**
 * Every setting written out, so neither the browser's locale nor a later change to the defaults
 * moves a story. The clock is on with 24-hour time, and the weather is on with a place.
 */
const SETTINGS: Settings = {
  clock: { enabled: true, hour12: false, showDate: true, showSeconds: false },
  dim: true,
  font: 'system',
  photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
  weather: {
    enabled: true,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: false },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: makePlace(),
    unit: 'celsius',
  },
}

/** The weather with no place chosen yet: what a Weather that was just added looks like. */
const NO_PLACE: Settings = { ...SETTINGS, weather: { ...SETTINGS.weather, place: null } }

/** Puts these settings in the (fake) browser storage before the story is drawn. */
const stored = (settings: Settings) => async () => {
  await settingsItem.setValue(settings)
}

type Props = Parameters<typeof OptionsForm>[0]

/**
 * What the Widgets keep in the settings, for as long as they do: a change to the options is laid
 * back over the settings they were read from, and a page-wide value goes to the Clock's own
 * setting. Phase 2 moves the options into the Layout; the form does not change.
 */
function withOptions(settings: Settings, type: string, next: Record<string, unknown>): Settings {
  if (type === clockDefinition.type) {
    const { showDate, showSeconds } = next as Pick<Settings['clock'], 'showDate' | 'showSeconds'>
    return { ...settings, clock: { ...settings.clock, showDate, showSeconds } }
  }
  const { fields, followDevice, place, unit } = next as Pick<
    Settings['weather'],
    'fields' | 'followDevice' | 'place' | 'unit'
  >
  return { ...settings, weather: { ...settings.weather, fields, followDevice, place, unit } }
}

/**
 * The form keeps nothing itself: whoever draws it owns the options. Here the settings in storage
 * do, as they do on the page today, so the form responds in a published Storybook as it will
 * there. It is drawn once they have been read, so it never shows the defaults first.
 */
function Stored({
  definition,
  onChange,
  onPageValueChange,
  ...props
}: Omit<Props, 'options' | 'page'>) {
  const [settings, setSettings, loaded] = useStorageItem(settingsItem)
  if (!loaded) return null
  const widget = widgetsFromSettings(settings).find(({ type }) => type === definition.type)
  return (
    <OptionsForm
      {...props}
      definition={definition}
      onChange={(next) => {
        onChange(next)
        setSettings(withOptions(settings, definition.type, next))
      }}
      onPageValueChange={(name, value) => {
        onPageValueChange(name, value)
        setSettings({ ...settings, clock: { ...settings.clock, [name]: value } })
      }}
      options={widget?.options}
      page={pageValues(settings)}
    />
  )
}

const meta = {
  args: {
    definition: clockDefinition,
    onChange: fn(),
    onPageValueChange: fn(),
  },
  beforeEach: stored(SETTINGS),
  component: Stored,
  decorators: [withPanel, withPage],
  render: (args) => <Stored {...args} />,
  title: 'OptionsForm',
} satisfies Meta<typeof Stored>
export default meta

type Story = StoryObj<typeof meta>

/** Three switches. "24-hour time" is on because the page is not 12-hour, and says it is the page's. */
export const Clock: Story = {}

/**
 * Everything a Weather has: the place, the units, the lines in order, the page's 24-hour time
 * and the credit.
 */
export const Weather: Story = {
  args: { definition: weatherDefinition },
}

/**
 * A Weather with no place, as the setup button opens it: the place search has focus, and its
 * suggestion is Current location.
 */
export const WeatherNoPlace: Story = {
  args: { definition: weatherDefinition, focusOption: 'place' },
  beforeEach: stored(NO_PLACE),
}

/** The options of a Widget that may not be changed: shown as they are, with nothing to press. */
export const Disabled: Story = {
  args: { definition: weatherDefinition, disabled: true },
}
