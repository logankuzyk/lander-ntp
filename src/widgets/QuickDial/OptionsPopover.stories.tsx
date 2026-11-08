import type { Meta, StoryObj } from '@storybook/preact-vite'

import { iconItem } from '@/quickDial/iconStorage'
import { OptionsForm } from '@/widgetSystem/OptionsForm'

import { withPage } from '../../../.storybook/withPage'
import { quickDialDefinition } from './definition'

function Form({ uploaded = false }: { uploaded?: boolean }) {
  return (
    <div style={{ width: 320 }}>
      <OptionsForm
        definition={quickDialDefinition}
        iconUrl={() =>
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#fff"/></svg>',
          )
        }
        onChange={() => {}}
        onPageValueChange={() => {}}
        options={{
          colour: '#f2e8cf',
          icon: uploaded ? 'abcdefgh' : null,
          label: 'Example',
          newTab: false,
          showIcon: true,
          url: 'example.com',
        }}
        page={{ hour12: false }}
      />
    </div>
  )
}

const meta = {
  component: Form,
  decorators: [withPage],
  title: 'OptionsPopover/QuickDial',
} satisfies Meta<typeof Form>
export default meta

type Story = StoryObj<typeof meta>

export const SiteIcon: Story = { args: { uploaded: false } }
export const Uploaded: Story = {
  args: { uploaded: true },
  beforeEach: async () => {
    await iconItem('abcdefgh').setValue({ data: 'data:image/webp;base64,YQ==', v: 1 })
  },
}
export const UploadError: Story = {
  args: { uploaded: false },
  parameters: {
    docs: { description: { story: 'Choose an unsupported or oversized image to see the error.' } },
  },
  render: () => <Form uploaded={false} />,
}
export const Encoding: Story = {
  args: { uploaded: false },
  parameters: {
    docs: { description: { story: 'Choose an image to see its encoded preview before saving.' } },
  },
  render: () => <Form uploaded={false} />,
}
