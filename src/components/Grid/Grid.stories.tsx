import type { Meta, StoryObj } from '@storybook/preact-vite'
import { userEvent } from 'storybook/test'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { holdDrag } from '../../../.storybook/holdDrag'
import { arrows, holdKeys } from '../../../.storybook/holdKeys'
import { holdResize } from '../../../.storybook/holdResize'
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
 * A stored Layout of nine Widgets, one over the Widget limit (two devices that each added one, say):
 * it loads whole and every Widget is drawn. Nothing is removed or hidden; only adding is off.
 */
export const NineWidgets: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridNineWidgets)
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
 * A Widget just removed with its × (pressed in the story as a person would): the Clock is gone,
 * the notice says "Clock removed." with Undo above the Bottom bar. Nothing comes after the Clock
 * in reading order (the Weather is in row 1, before it), so focus has moved to Done. The notice
 * goes by itself after 8 seconds, so a story left open long enough shows the Grid without it.
 */
export const EditingWithUndo: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    const canvas = await startEditing(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Remove Clock' }))
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

/**
 * The Clock held by its handle, at its bottom right corner, two columns and a row bigger: the
 * Clock grows with the pointer, and an outline shows the cells it will have (6 by 3 from column
 * 3, row 3). The pointer is still down, so nothing has been saved.
 */
export const Resizing: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdResize(canvasElement, 'Clock', { cols: 2, rows: 1 })
  },
}

/**
 * The Clock pulled much further than it goes (across and down towards the edge of the Grid): it
 * stops at its largest size, 8 by 4, and no further, however far the pointer is. The outline is
 * the allowed one. Pulled back the other way it stops at its smallest, 3 by 2 (see
 * `ResizeStopsAtSmallest`).
 */
export const ResizeStopsAtLimits: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdResize(canvasElement, 'Clock', { cols: 9, rows: 5 })
  },
}

/**
 * The Clock pulled back past its top left corner: it stops at its smallest size, 3 by 2, and
 * does not get smaller, however far the pointer goes.
 */
export const ResizeStopsAtSmallest: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdResize(canvasElement, 'Clock', { cols: -6, rows: -4 })
  },
}

/**
 * The Clock pulled over the Weather beside it: the outline is red and dashed, because the size
 * is refused. Letting go would put the Clock back at the size it had, with no error and nothing
 * saved.
 */
export const ResizeRefused: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeBeside)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdResize(canvasElement, 'Clock', { cols: 3, rows: 0 })
  },
}

/**
 * Resizing with the system asking for reduced motion: the Clock does not follow the pointer, it
 * is the whole cells it will have. It is held a little off the cell, so following would show.
 */
export const ResizeReducedMotion: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
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
    await holdResize(canvasElement, 'Clock', { cols: 1.6, rows: 0.4 })
  },
}

/**
 * The Clock picked up from the keyboard (Enter on its frame): lifted above the others, with an
 * outline of where it would be put down, which is where it is. Arrow keys move it, Shift and the
 * arrows resize it, Enter puts it down and Escape puts it back. A screen reader hears "Clock
 * picked up at column 5, row 4" and the keys. Nothing is saved until it is put down.
 */
export const KeyboardPickedUp: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock')
  },
}

/**
 * The Clock picked up and moved two columns right and a row down with the arrow keys (it was at
 * column 3, row 3): it is drawn in the cells it would be put down in, one step at a time.
 */
export const KeyboardMoved: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock', [...arrows('Right', 2), ...arrows('Down', 1)])
  },
}

/**
 * The Clock picked up and made two columns wider and a row taller with Shift and the arrow keys:
 * 6 by 3 from column 3, row 3. It lays itself out in the size it will be as each key is pressed.
 */
export const KeyboardResizing: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock', [
      ...arrows('Right', 2, true),
      ...arrows('Down', 1, true),
    ])
  },
}

/**
 * Shift and the right arrow pressed more times than the Clock has room for: it stops at its
 * largest width, 8 columns, and says "Largest size". Shift and the left arrow stops it at its
 * smallest, 3 columns, the same way.
 */
export const KeyboardResizeStopsAtLimits: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock', arrows('Right', 6, true))
  },
}

/**
 * The Clock walked with the arrow keys over the Weather in the top right corner: the outline is
 * red and dashed, because the place is refused, and a screen reader hears "Another widget is
 * there". Enter would not put it down; the arrows carry it on past the Weather, or Escape puts it
 * back.
 */
export const KeyboardRefused: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock', [...arrows('Up', 3), ...arrows('Right', 3)])
  },
}

/**
 * The Clock pushed left past the Grid's edge: it stops at column 1 and says "Edge of the grid"
 * instead of going off it.
 */
export const KeyboardGridEdge: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.gridResizeRoom)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await holdKeys(canvasElement, 'Clock', arrows('Left', 5))
  },
}
