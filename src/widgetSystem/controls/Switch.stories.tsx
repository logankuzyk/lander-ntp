import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import { withPage } from '../../../.storybook/withPage'
import { useStoryValue, withPanel } from '../../../.storybook/withPanel'
import { Switch } from './Switch'

type Props = Parameters<typeof Switch>[0]

function Stateful({ checked: initial, onChange, ...props }: Props) {
  const [checked, setChecked] = useStoryValue(initial, onChange)
  return <Switch {...props} checked={checked} onChange={setChecked} />
}

const meta = {
  args: { checked: true, label: 'Show date', onChange: fn() },
  component: Switch,
  decorators: [withPanel, withPage],
  render: (args) => <Stateful {...args} />,
  title: 'Controls/Switch',
} satisfies Meta<typeof Switch>
export default meta

type Story = StoryObj<typeof meta>

export const On: Story = {}

export const Off: Story = { args: { checked: false } }
