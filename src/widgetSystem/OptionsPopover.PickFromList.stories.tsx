import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useRef, useState } from 'preact/hooks'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { withPage } from '../../.storybook/withPage'
import { withPanel } from '../../.storybook/withPanel'
import type { PageValues, WidgetDefinition } from './definition'
import { OptionsPopover } from './OptionsPopover'

const PAGE: PageValues = { hour12: false }
const definition: WidgetDefinition<Record<string, unknown>> = {
  name: 'Example',
  options: [
    {
      control: 'pick',
      default: 'work',
      emptyText: 'No folders found',
      failedText: 'Could not load folders',
      id: 'folder',
      label: 'Folder',
      load: async () => [
        { label: 'Bookmarks bar', value: 'bar' },
        { depth: 1, label: 'Work', value: 'work' },
      ],
    },
  ],
  sizes: { largest: { h: 1, w: 1 }, smallest: { h: 1, w: 1 }, starting: () => ({ h: 1, w: 1 }) },
  type: 'example',
  View: () => null,
}

function PickOptionsPopover() {
  const anchor = useRef<HTMLDivElement>(null)
  const [options, setOptions] = useState<Record<string, unknown>>({ folder: 'work' })
  return (
    <>
      <div ref={anchor} style={{ background: 'var(--surface)', height: '10rem', width: '18rem' }}>
        Example Widget
      </div>
      <OptionsPopover
        box={() => anchor.current}
        definition={definition}
        name="Example"
        onChange={(next) => setOptions(next)}
        onClose={() => {}}
        onPageValueChange={() => {}}
        options={options}
        page={PAGE}
      />
    </>
  )
}

const meta = {
  beforeEach: async () => {
    await settingsItem.setValue(DEFAULT_SETTINGS)
  },
  component: PickOptionsPopover,
  decorators: [withPanel, withPage],
  title: 'OptionsPopover/PickFromList',
} satisfies Meta<typeof PickOptionsPopover>
export default meta

type Story = StoryObj<typeof meta>

export const Folder: Story = {}
