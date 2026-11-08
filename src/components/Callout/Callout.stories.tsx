import type { Meta, StoryObj } from '@storybook/preact-vite'
import type { ComponentChildren } from 'preact'
import { fn } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import type { CalloutTarget } from '@/onboarding/target'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { Callout } from './Callout'

// A callout beside a thing on the page. The whole page is drawn (`App`, with a seeded Layout, and
// no request made) and the callout is drawn beside it: nothing in `NEWS` points at the page yet,
// so the story brings its own, with words that say what the story shows and are not the words
// the tour and the news will use. They fill the window; the toolbar's Viewport menu has the two
// windows the Grid is judged at (1440 by 900, 1366 by 768) and a phone's, 390 by 800.
const meta = {
  component: App,
  title: 'Callout',
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/**
 * The seeded readings are fresh for 30 minutes. A story left open longer would ask Open-Meteo
 * for new ones: a request that never settles keeps the reading and sends nothing.
 */
function sendNothing() {
  const real = globalThis.fetch
  globalThis.fetch = () => new Promise<Response>(() => {})
  return () => {
    globalThis.fetch = real
  }
}

type BesidePageProps = {
  body: string
  /** More of the page for the callout to keep clear of, drawn after the page. */
  children?: ComponentChildren
  target: CalloutTarget
  title: string
}

/** The page, and a callout beside one of its parts. */
function BesidePage({ body, children, target, title }: BesidePageProps) {
  return (
    <>
      <App />
      {children}
      <Callout
        action={{ label: 'Got it', onClick: fn() }}
        body={body}
        onDismiss={fn()}
        target={target}
        title={title}
      />
    </>
  )
}

/**
 * Beside the Edit button, in the Bottom bar: above it, with its pointer down at the button and
 * the callout wholly in the window, at any size of it.
 */
export const BesideEdit: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  render: () => (
    <BesidePage
      body="A callout above the Edit button, pointing down at it."
      target="edit"
      title="Beside Edit"
    />
  ),
}

/**
 * Beside a Widget, found by its type: the Weather in the top right corner, which has no room on
 * its right, so the callout goes to its left (there is room for it even on a phone). Nothing is drawn round
 * the Widget.
 */
export const BesideWidget: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  render: () => (
    <BesidePage
      body="A callout beside the Weather, pointing at it."
      target="widget:weather"
      title="Beside a Widget"
    />
  ),
}

/**
 * Beside an item of the Add menu. The menu itself is a later change, so a stand-in menu is drawn
 * in its place (a menu with a Clock item and a Weather item, open above the Bottom bar) and
 * carries the item's `data-callout-target`. The callout keeps clear of the menu: it goes to
 * its left, level with the item.
 */
export const BesideAddItem: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  render: () => (
    <BesidePage
      body="A callout beside an item of the menu, clear of the menu."
      target="menu:clock"
      title="Beside a menu item"
    >
      <div
        aria-label="Add a widget (a stand-in for the Add menu)"
        class="popover"
        role="menu"
        style={{ display: 'grid', gap: '0.25rem', width: '11rem' }}
      >
        <button data-callout-target="menu:clock" role="menuitem" type="button">
          Clock
        </button>
        <button data-callout-target="menu:weather" role="menuitem" type="button">
          Weather
        </button>
      </div>
    </BesidePage>
  ),
}
