import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import { withPage } from '../../../.storybook/withPage'
import { useStoryValue, withPanel } from '../../../.storybook/withPanel'
import type { ListEntry } from '../definition'
import { OrderedListControl } from './OrderedListControl'

type Props = Parameters<typeof OrderedListControl>[0]

function Stateful({ onChange, value: initial, ...props }: Props) {
  const [value, setValue] = useStoryValue<readonly ListEntry[]>(initial, (next) =>
    onChange([...next]),
  )
  return (
    <>
      <h3 id={props.labelledBy}>Show</h3>
      <OrderedListControl {...props} onChange={setValue} value={value} />
    </>
  )
}

const meta = {
  args: {
    items: [
      { id: 'condition', label: 'Conditions' },
      { id: 'feelsLike', label: 'Feels like' },
      { id: 'highLow', label: 'High and low' },
      { id: 'location', label: 'Location' },
      { id: 'sun', label: 'Sunrise and sunset' },
    ],
    labelledBy: 'list-heading',
    onChange: fn(),
    value: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: false },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
    ],
  },
  component: OrderedListControl,
  decorators: [withPanel, withPage],
  render: (args) => <Stateful {...args} />,
  title: 'Controls/OrderedList',
} satisfies Meta<typeof OrderedListControl>
export default meta

type Story = StoryObj<typeof meta>

/** Two shown and three hidden. Drag a row, or use the arrow keys from its handle. */
export const SomeShown: Story = {}

export const AllShown: Story = {
  args: {
    value: [
      { id: 'condition', shown: true },
      { id: 'feelsLike', shown: true },
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: true },
    ],
  },
}

export const NoneShown: Story = {
  args: {
    value: [
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
      { id: 'highLow', shown: false },
      { id: 'location', shown: false },
      { id: 'sun', shown: false },
    ],
  },
}
