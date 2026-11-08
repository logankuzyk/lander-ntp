import type { Meta, StoryObj } from '@storybook/preact-vite'

import { OptionsForm } from '@/widgetSystem/OptionsForm'

import { quickDialDefinition } from './definition'

function Form() {
  return (
    <OptionsForm
      definition={quickDialDefinition}
      onChange={() => {}}
      onPageValueChange={() => {}}
      options={{ icon: null, label: 'Example site', newTab: false, url: 'https://example.com' }}
      page={{ hour12: false }}
    />
  )
}

const meta = { component: Form, title: 'OptionsPopover/QuickDial' } satisfies Meta<typeof Form>
export default meta
type Story = StoryObj<typeof meta>
export const SiteAndPreview: Story = {}
