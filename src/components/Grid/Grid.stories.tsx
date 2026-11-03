import type { Meta, StoryObj } from '@storybook/preact-vite'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { holdDrag } from '../../../.storybook/holdDrag'
import { startEditing } from '../../../.storybook/startEditing'

// The whole page, as `App` stories are: no `withPage`. Each story seeds the storage it needs, and
// makes no request. They fill the window; the toolbar's Viewport menu has the two sizes to look
// at, 1440 by 900 and 1366 by 768 (a story that sets `globals.viewport` would lock the menu, so
// none does). The seeds are in PAGE_SEEDS, where src/test/seed.test.tsx checks each
// draws what its story says.
const meta = {
  component: App,
  title: 'Grid',
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

/** Nothing stored but the defaults: the Clock alone, in the middle (column 5, row 4, 4 by 2). */
export const NewInstall: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridNewInstall),
}

/**
 * Updated with the Clock and the Weather on: the Layout is worked out from the settings, the
 * Weather in the top right corner (column 11, row 1, 2 by 2) and the Clock where it was.
 */
export const UpdatedClockAndWeather: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
}

/** A Clock with seconds takes six columns, from column 4, so it stays in the middle. */
export const ClockWithSeconds: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridClockWithSeconds),
}

/** Both off: the Grid is there and empty, over the photo. */
export const Empty: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridEmpty),
}

/** Eight Widgets in a stored Layout: four Clocks and four Weathers. */
export const EightWidgets: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridEightWidgets)
    return sendNothing()
  },
}

/**
 * Edit mode, entered by pressing Edit as a person would (it is page state, so nothing is
 * seeded for it): the dots over the Grid, and a frame with its name on each Widget. Here the
 * Weather in the top right corner and the Clock in the middle.
 */
export const EditingTwoWidgets: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await startEditing(canvasElement)
  },
}

/**
 * Edit mode with two Weathers, for Victoria and for Vancouver: each frame's name says its place,
 * so the two can be told apart (to the eye and to a screen reader).
 */
export const EditingTwoWeathers: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridTwoWeathers)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await startEditing(canvasElement)
  },
}

/** Edit mode with no Widgets: the dots alone. */
export const EditingEmpty: Story = {
  beforeEach: () => seedPage(PAGE_SEEDS.gridEmpty),
  play: async ({ canvasElement }) => {
    await startEditing(canvasElement)
  },
}

/** Edit mode with the first Widget reached by Tab: the focus ring on its frame. */
export const EditingFocused: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    // Where Tab goes first: the frames come before the Bottom bar in the page.
    const [first] = await canvas.findAllByRole('group')
    first?.focus()
  },
}

/**
 * The Clock picked up and held two columns left and one row down: it follows the pointer, and an
 * outline shows the cells it will land in (column 3, row 5). The pointer is still down, so nothing
 * has been saved.
 */
export const Dragging: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdDrag(canvasElement, 'Clock', { cols: -2, rows: 1 })
  },
}

/**
 * The Clock held over the Weather in the top right corner: the outline is red and dashed, because
 * the place is refused. Letting go would put the Clock back, with no error and nothing saved.
 */
export const DraggingRefused: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdDrag(canvasElement, 'Clock', { cols: 4, rows: -3 })
  },
}

/**
 * Dragging with the system asking for reduced motion: the Clock does not follow the pointer, it
 * sits in the cell it will land in. It is held a little off the cell, so following would show.
 */
export const DraggingReducedMotion: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    const restoreFetch = sendNothing()
    const real = window.matchMedia.bind(window)
    // Only the question about motion is answered differently; its answer never changes here.
    window.matchMedia = (query: string) =>
      query.includes('prefers-reduced-motion')
        ? ({
            addEventListener: () => {},
            matches: true,
            media: query,
            removeEventListener: () => {},
          } as unknown as MediaQueryList)
        : real(query)
    return () => {
      window.matchMedia = real
      restoreFetch()
    }
  },
  play: async ({ canvasElement }) => {
    await holdDrag(canvasElement, 'Clock', { cols: -2.3, rows: 1 })
  },
}
