import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn, userEvent, within } from 'storybook/test'

import { makePlace } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { useStoryValue, withPanel } from '../../../.storybook/withPanel'
import { PlaceControl } from './PlaceControl'

type Props = Parameters<typeof PlaceControl>[0]

function Stateful({ onChange, value: initial, ...props }: Props) {
  const [value, setValue] = useStoryValue(initial, onChange)
  return <PlaceControl {...props} onChange={setValue} value={value} />
}

const meta = {
  args: {
    label: 'Place',
    onChange: fn(),
    value: { followDevice: false, place: null },
  },
  component: PlaceControl,
  decorators: [withPanel, withPage],
  render: (args) => <Stateful {...args} />,
  title: 'Controls/PlaceControl',
} satisfies Meta<typeof PlaceControl>
export default meta

type Story = StoryObj<typeof meta>

/** No place yet: the search box. Focus it for the current location. */
export const Empty: Story = {}

export const Set: Story = {
  args: { value: { followDevice: false, place: makePlace() } },
}

/** Following the device: the place the search last held is kept, and not shown. */
export const Following: Story = {
  args: { value: { followDevice: true, place: null } },
}

/** What the place search finds for "Victoria", answered here and not by Open-Meteo. */
const FOUND = {
  results: [
    {
      admin1: 'British Columbia',
      country: 'Canada',
      id: 1,
      latitude: 48.4359,
      longitude: -123.35155,
      name: 'Victoria',
    },
    {
      admin1: 'Texas',
      country: 'United States',
      id: 2,
      latitude: 28.8053,
      longitude: -97.0036,
      name: 'Victoria',
    },
    {
      admin1: 'Mahé',
      country: 'Seychelles',
      id: 3,
      latitude: -4.6167,
      longitude: 55.45,
      name: 'Victoria',
    },
  ],
}

/** Typed into, with the places a stubbed search found listed under the box. */
export const WithResults: Story = {
  beforeEach: () => {
    // The search is the only request a story could make. Answered here, nothing is sent.
    const real = globalThis.fetch
    globalThis.fetch = () => Promise.resolve(Response.json(FOUND))
    return () => {
      globalThis.fetch = real
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('combobox', { name: 'Search for a place' }), 'Victoria')
    await canvas.findByRole('option', { name: 'Victoria, British Columbia, Canada' })
  },
}
