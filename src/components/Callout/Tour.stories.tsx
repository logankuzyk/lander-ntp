import type { Meta, StoryObj } from '@storybook/preact-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { App } from '@/entrypoints/newtab/App'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { takeTour } from '../../../.storybook/takeTour'

// The guided tour a new install is offered by the welcome, each stop as a person reaches it: the
// whole page (`App`) over a seeded new install, the welcome answered with "Show me around" and
// Next pressed until the stop. The tour is page state, so storage only holds the install. Nothing
// is fetched. They fill the window; the toolbar's Viewport menu has 1440 by 900, 1366 by 768 and
// a phone's 390 by 800. The words are proposed, for the owner (LR-107).
const meta = {
  component: App,
  title: 'Tour',
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

/** A new install on its defaults, the Clock alone, before the welcome is answered. */
const newInstall = async () => {
  await seedPage(PAGE_SEEDS.newInstall)
  return sendNothing()
}

/** The welcome: "Show me around" starts the tour, Skip does not. */
export const Welcome: Story = { beforeEach: newInstall }

/** Stop 1 of 8: beside the Edit button, with the page not yet in edit mode. */
export const Edit: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement)
  },
}

/** Stop 2: in edit mode, beside the Clock, which is the first widget on the page. */
export const MoveAndResize: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Move and resize')
  },
}

/** Stop 3: beside the Options button in the Clock's corner. */
export const Options: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Options')
  },
}

/**
 * Stop 4: the Add menu has opened by itself and the note is beside it, level with its first
 * item. Focus is still on the note's Next button, not in the menu.
 */
export const Add: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    const canvas = await takeTour(canvasElement, 'Add a widget')
    await expect(canvas.getByRole('menu', { name: 'Add a widget' })).toBeTruthy()
  },
}

/** Stop 5: the menu has shut; the note is beside the Done button. */
export const Done: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'When you are done')
  },
}

/**
 * Stop 6: Next on Done has left edit mode and opened the settings panel, whose own note carries
 * on the count.
 */
export const Photos: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Photos')
  },
}

/** Stop 7: the Account section in the settings panel. */
export const Account: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Account')
  },
}

/** Stop 8, the last: the font, in the settings panel. */
export const Font: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Font')
  },
}

/** The welcome skipped: no tour, and none is offered again. */
export const SkippedWelcome: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull())
    await expect(canvas.queryByRole('note')).toBeNull()
  },
}

/**
 * Dismissed at the Options stop: the note is gone and edit mode is put back, with no settings
 * panel and nothing stored.
 */
export const DismissedMidTour: Story = {
  beforeEach: newInstall,
  play: async ({ canvasElement }) => {
    const canvas = await takeTour(canvasElement, 'Options')
    await userEvent.click(within(canvas.getByRole('note')).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(canvas.queryByRole('note')).toBeNull())
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeTruthy()
  },
}

/**
 * A Weather waiting for a place, with its setup button on the page: the tour has a stop for it
 * (4 of 9), and the Add stop does not repeat it.
 */
export const Setup: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.tourWeatherWaiting)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Set up a widget')
  },
}

/** The Clock and a Weather for Victoria: the move and resize stop is beside the Weather, first on the page. */
export const ClockAndWeather: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.tourClockAndWeather)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Move and resize')
  },
}

/** An empty Grid: no stops about a widget (2 of 6 is Add). */
export const EmptyGrid: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.tourEmptyGrid)
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement, 'Add a widget')
  },
}

/**
 * A Layout that a newer version of the page wrote, which this one cannot change: the tour has
 * the Edit and Done stops and the panel's three (1 of 5), and the Edit stop says to update.
 */
export const NewerLayout: Story = {
  beforeEach: async () => {
    await seedPage(PAGE_SEEDS.newInstall)
    await fakeBrowser.storage.sync.set({
      layout: {
        v: 2,
        widgets: [
          {
            col: 5,
            h: 2,
            id: 'clock0aa',
            options: { showDate: false, showSeconds: false },
            row: 4,
            type: 'clock',
            w: 4,
          },
        ],
      },
    })
    return sendNothing()
  },
  play: async ({ canvasElement }) => {
    await takeTour(canvasElement)
  },
}
