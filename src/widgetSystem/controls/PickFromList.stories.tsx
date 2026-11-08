import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useState } from 'preact/hooks'
import { fn } from 'storybook/test'

import type { Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { withPage } from '../../../.storybook/withPage'
import { withPanel } from '../../../.storybook/withPanel'
import type { PickChoice } from '../definition'
import { PickFromList } from './PickFromList'

const SETTINGS: Settings = {
  clock: { enabled: true, hour12: false, showDate: true, showSeconds: false },
  dim: false,
  font: 'system',
  photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
  v: 1,
  weather: {
    enabled: false,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: false },
      { id: 'condition', shown: true },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: null,
    unit: 'celsius',
  },
}

const CHOICES: readonly PickChoice[] = [
  { label: 'Bookmarks bar', value: 'bar' },
  { depth: 1, label: 'Work', value: 'work' },
  { depth: 2, label: 'Projects', value: 'projects' },
  { label: 'Personal', value: 'personal' },
]

const loadChoices = async () => CHOICES

const meta = {
  args: {
    emptyText: 'No folders found',
    failedText: 'Could not load folders',
    label: 'Folder',
    load: loadChoices,
    value: 'bar',
  },
  beforeEach: async () => {
    await settingsItem.setValue(SETTINGS)
  },
  component: Stateful,
  decorators: [withPanel, withPage],
  render: (args) => <Stateful {...args} />,
  title: 'Controls/PickFromList',
} satisfies Meta<typeof Stateful>
export default meta

type Story = StoryObj<typeof meta>
type StoryProps = {
  emptyText: string
  failedText: string
  label: string
  load: () => Promise<readonly PickChoice[]>
  multiple?: boolean
  onChange?: (value: string | string[]) => void
  value: string | string[]
}

function Stateful({
  emptyText,
  failedText,
  label,
  load,
  multiple,
  onChange = fn(),
  value,
}: StoryProps) {
  const [current, setCurrent] = useState(value)
  if (multiple) {
    return (
      <PickFromList
        emptyText={emptyText}
        failedText={failedText}
        label={label}
        load={load}
        multiple
        onChange={(next) => {
          setCurrent(next)
          onChange(next)
        }}
        value={Array.isArray(current) ? current : []}
      />
    )
  }
  return (
    <PickFromList
      emptyText={emptyText}
      failedText={failedText}
      label={label}
      load={load}
      onChange={(next) => {
        setCurrent(next)
        onChange(next)
      }}
      value={typeof current === 'string' ? current : ''}
    />
  )
}

export const Loading: Story = {
  args: { load: () => new Promise(() => {}) },
}

export const Ready: Story = {}

export const Empty: Story = { args: { load: async () => [] } }

let failures = 0
export const Failed: Story = {
  args: {
    load: async () => {
      if (failures++ === 0) throw new Error('offline')
      return CHOICES
    },
  },
  beforeEach: async () => {
    failures = 0
    await settingsItem.setValue(SETTINGS)
  },
}

export const ValueMissing: Story = { args: { value: 'other-device-folder' } }

export const Many: Story = {
  args: {
    load: loadChoices,
    multiple: true,
    value: ['bar', 'work'],
  },
}
