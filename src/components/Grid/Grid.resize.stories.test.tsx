import { render, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './Grid.stories'

// Cells of 100 by 100 pixels, the Grid at the window's top left (happy-dom measures nothing).
// The Clock is at column 3, and the Weather in the top right corner or beside it (column 8), as
// the stories seed them.
const GRID = { height: 800, left: 0, top: 0, width: 1200 }

type ResizeStory = {
  beforeEach: () => Promise<() => void>
  play: (context: { canvasElement: HTMLElement }) => Promise<void>
}

/** Runs a story as Storybook does: its `beforeEach`, the page, then its `play`. */
async function runStory(story: ResizeStory) {
  const restore = await story.beforeEach()
  // After the seeding, which is writes of its own: only what the page does is counted.
  const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
  const { container } = render(<App />)
  await story.play({ canvasElement: container as HTMLElement })
  return { container, restore, set }
}

const ghost = () => document.querySelector<HTMLElement>('.grid__ghost')
const clockBox = () => document.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = this.classList.contains('grid') ? GRID : { height: 0, left: 0, top: 0, width: 0 }
    return {
      ...r,
      bottom: r.top + r.height,
      right: r.left + r.width,
      x: r.left,
      y: r.top,
    } as DOMRect
  })
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: () => {},
    matches: false,
    removeEventListener: () => {},
  }))
})

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the Grid resizing stories', () => {
  it('Resizing holds the Clock two columns and a row bigger: an allowed outline of 6 by 3', async () => {
    const { restore, set } = await runStory(stories.Resizing as unknown as ResizeStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 6'))
    expect(ghost()?.style.gridRow).toBe('3 / span 3')
    expect(ghost()?.dataset.valid).toBe('true')
    // The pointer is still down: the Clock grows with it, and nothing is saved.
    expect(document.querySelector('.widget-box--resizing')).not.toBeNull()
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('ResizeStopsAtLimits pulls the Clock far past its largest: the outline stops at 8 by 4', async () => {
    const { restore, set } = await runStory(stories.ResizeStopsAtLimits as unknown as ResizeStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 8'))
    expect(ghost()?.style.gridRow).toBe('3 / span 4')
    expect(ghost()?.dataset.valid).toBe('true')
    expect([clockBox()?.style.width, clockBox()?.style.height]).toEqual(['800px', '400px'])
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('ResizeStopsAtSmallest pulls the Clock back past its corner: the outline stops at 3 by 2', async () => {
    const { restore, set } = await runStory(stories.ResizeStopsAtSmallest as unknown as ResizeStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 3'))
    expect(ghost()?.style.gridRow).toBe('3 / span 2')
    expect(ghost()?.dataset.valid).toBe('true')
    expect([clockBox()?.style.width, clockBox()?.style.height]).toEqual(['300px', '200px'])
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('ResizeRefused pulls the Clock onto the Weather: the outline is refused', async () => {
    const { restore, set } = await runStory(stories.ResizeRefused as unknown as ResizeStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 7'))
    expect(ghost()?.dataset.valid).toBe('false')
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('ResizeReducedMotion sizes the Clock to the cells it will have, not under the pointer', async () => {
    const { restore } = await runStory(stories.ResizeReducedMotion as unknown as ResizeStory)

    await waitFor(() => expect(clockBox()?.style.width).toBe('600px'))
    // Held 1.6 columns and 0.4 of a row bigger: 5.6 by 2.4 cells, which are 6 by 2.
    expect([clockBox()?.style.width, clockBox()?.style.height]).toEqual(['600px', '200px'])
    restore()
  })
})
