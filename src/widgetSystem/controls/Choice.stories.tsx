import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import { withPage } from '../../../.storybook/withPage'
import { useStoryValue, withPanel } from '../../../.storybook/withPanel'
import { Choice } from './Choice'

type Props = Parameters<typeof Choice<string>>[0]

function Stateful({ onChange, value: initial, ...props }: Props) {
  const [value, setValue] = useStoryValue(initial, onChange)
  return <Choice {...props} onChange={setValue} value={value} />
}

const meta = {
  args: {
    choices: [
      { label: 'Celsius', value: 'celsius' },
      { label: 'Fahrenheit', value: 'fahrenheit' },
    ],
    label: 'Units',
    onChange: fn(),
    value: 'celsius',
  },
  component: Choice<string>,
  decorators: [withPanel, withPage],
  render: (args) => <Stateful {...args} />,
  title: 'Controls/Choice',
} satisfies Meta<typeof Choice<string>>
export default meta

type Story = StoryObj<typeof meta>

export const Units: Story = {}

export const Fahrenheit: Story = { args: { value: 'fahrenheit' } }

/** More choices than fit at once: the menu scrolls. */
export const ManyChoices: Story = {
  args: {
    choices: [
      { label: 'Every 30 seconds', value: '30s' },
      { label: 'Every minute', value: '1m' },
      { label: 'Every 5 minutes', value: '5m' },
      { label: 'Every 15 minutes', value: '15m' },
      { label: 'Every hour', value: '1h' },
      { label: 'Every 6 hours', value: '6h' },
      { label: 'Every 12 hours', value: '12h' },
      { label: 'Every day', value: 'daily' },
      { label: 'Every new tab', value: 'every-visit' },
      { label: 'Never', value: 'never' },
    ],
    label: 'Change photo',
    value: 'every-visit',
  },
}
