import type { Meta, StoryObj } from '@storybook/preact-vite'
import type { JSX } from 'preact'

import { COLS, ROWS } from '@/layout/geometry'
import { EXAMPLE_SIZES } from '@/test/fixtures'

import { withPage } from '../../.storybook/withPage'
import type { WidgetDefinition } from './definition'
import type { Reading, ReadingCache, Source } from './source'
import { WidgetBox } from './WidgetBox'

// A made-up Widget in each state its box can draw instead of its View, side by side on the Grid,
// each in a box of 3 by 3 cells. Nothing here asks the network: the source's request either
// never answers or fails, and a switched-off source is not asked at all. The loading box
// appears after about 400 ms. The Weather's own are in Weather/Loading, Failed and Off.
const meta = { decorators: [withPage], title: 'WidgetBox' } satisfies Meta
export default meta

type Story = StoryObj<typeof meta>

type Options = Record<string, never>

/** A source that keeps nothing in memory and asks `fetch`, or is switched off. */
function exampleDefinition(
  fetch: () => Promise<number | null>,
  enabled = true,
): WidgetDefinition<Options, number, undefined> {
  const readings = new Map<string, Reading<number>>()
  const cache: ReadingCache<number> = {
    get: (key) => Promise.resolve(readings.get(key) ?? null),
    set: (key, reading) => {
      readings.set(key, reading)
      return Promise.resolve()
    },
  }
  const source: Source<number> = {
    cache,
    enabled: () => Promise.resolve(enabled),
    maxAgeMs: 60_000,
    maxStaleMs: 600_000,
    retryMs: 60_000,
  }
  return {
    name: 'Example',
    options: [],
    sizes: EXAMPLE_SIZES,
    source: { source, useQuery: () => ({ context: undefined, query: { fetch, key: 'example' } }) },
    type: 'example',
    View: ({ reading }) => <p>{reading}</p>,
  }
}

const LOADING = exampleDefinition(() => new Promise<number>(() => {}))
const FAILED = exampleDefinition(() => Promise.resolve(null))
const OFF = exampleDefinition(() => Promise.resolve(1), false)

const PAGE = { hour12: false }

/** Loading, failed and switched off, left to right. */
export const States: Story = {
  render: () => (
    <div
      class="grid"
      style={{ '--cols': String(COLS), '--rows': String(ROWS) } as JSX.CSSProperties}
    >
      <WidgetBox
        definition={LOADING}
        options={{}}
        page={PAGE}
        rect={{ col: 1, h: 3, row: 3, w: 3 }}
      />
      <WidgetBox
        definition={FAILED}
        options={{}}
        page={PAGE}
        rect={{ col: 5, h: 3, row: 3, w: 3 }}
      />
      <WidgetBox definition={OFF} options={{}} page={PAGE} rect={{ col: 9, h: 3, row: 3, w: 3 }} />
    </div>
  ),
}
