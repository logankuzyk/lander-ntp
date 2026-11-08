import { render, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './Grid.stories'

// Cells of 100 by 100 pixels, the Grid at the window's top left (happy-dom measures nothing).
// The Clock is at column 5, row 4 and the Weather at column 11, row 1, as the stories seed them.
const GRID = { height: 800, left: 0, top: 0, width: 1200 }
const BOXES: Record<string, { height: number; left: number; top: number; width: number }> = {
  clock: { height: 200, left: 400, top: 300, width: 400 },
  weather: { height: 200, left: 1000, top: 0, width: 200 },
}

type DragStory = {
  beforeEach: () => Promise<() => void>
  play: (context: { canvasElement: HTMLElement }) => Promise<void>
}

/** Runs a story as Storybook does: its `beforeEach`, the page, then its `play`. */
async function runStory(story: DragStory) {
  const restore = await story.beforeEach()
  // After the seeding, which is writes of its own: only what the page does is counted.
  const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
  const { container } = render(<App />)
  await story.play({ canvasElement: container as HTMLElement })
  return { container, restore, set }
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = this.classList.contains('grid')
      ? GRID
      : ((this as HTMLElement).dataset.widget && BOXES[(this as HTMLElement).dataset.widget!]) || {
          height: 0,
          left: 0,
          top: 0,
          width: 0,
        }
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

describe('the Grid dragging stories', () => {
  it('Dragging holds the Clock over free cells: an allowed outline at column 3, row 5', async () => {
    vi.stubGlobal('fetch', fetchSpy)
    const { restore, set } = await runStory(stories.Dragging as unknown as DragStory)
    vi.stubGlobal('fetch', fetchSpy)

    await waitFor(() => expect(document.querySelector('.grid__ghost')).not.toBeNull())
    const ghost = document.querySelector<HTMLElement>('.grid__ghost')
    expect(ghost?.dataset.valid).toBe('true')
    expect([ghost?.style.gridColumn, ghost?.style.gridRow]).toEqual(['3 / span 4', '5 / span 2'])
    // The pointer is still down: it follows, and nothing is saved, not even by looking.
    expect(document.querySelector('.widget-box--moving')).not.toBeNull()
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('DraggingRefused holds the Clock over the Weather: the outline is refused', async () => {
    vi.stubGlobal('fetch', fetchSpy)
    const { restore, set } = await runStory(stories.DraggingRefused as unknown as DragStory)

    await waitFor(() => expect(document.querySelector('.grid__ghost')).not.toBeNull())
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('false')
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('DraggingReducedMotion sits the Clock in the cell it will land in, not under the pointer', async () => {
    const { restore } = await runStory(stories.DraggingReducedMotion as unknown as DragStory)

    await waitFor(() => expect(document.querySelector('.grid__ghost')).not.toBeNull())
    // Held 2.3 columns left and one row down; the Clock's corner is a cell and a half in.
    const clock = document.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')
    expect(clock?.style.transform).toBe('translate(-200px, 100px)')
    restore()
  })
})
