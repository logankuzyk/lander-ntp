import { render, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './Grid.stories'

// Cells of 100 by 100 pixels, the Grid at the window's top left (happy-dom measures nothing).
// The stories seed the Clock at column 5, row 4 with the Weather in the top right corner, or the
// Clock at column 3, row 3 with room all round it.
const GRID = { height: 800, left: 0, top: 0, width: 1200 }

type KeyStory = {
  beforeEach: () => Promise<() => void>
  play: (context: { canvasElement: HTMLElement }) => Promise<void>
}

/** Runs a story as Storybook does: its `beforeEach`, the page, then its `play`. */
async function runStory(story: KeyStory) {
  const restore = await story.beforeEach()
  // After the seeding, which is writes of its own: only what the page does is counted.
  const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
  const { container } = render(<App />)
  await story.play({ canvasElement: container as HTMLElement })
  return { container, restore, set }
}

const ghost = () => document.querySelector<HTMLElement>('.grid__ghost')
const clockBox = () => document.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')
const said = () => document.querySelector('.grid + [aria-live="polite"]')?.textContent ?? ''

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

describe('the Grid keyboard stories', () => {
  it('KeyboardPickedUp holds the Clock where it is, outlined, with the Widget in the air', async () => {
    const { restore, set } = await runStory(stories.KeyboardPickedUp as unknown as KeyStory)

    await waitFor(() => expect(clockBox()?.classList.contains('widget-box--held')).toBe(true))
    expect(ghost()?.style.gridColumn).toBe('5 / span 4')
    expect(ghost()?.style.gridRow).toBe('4 / span 2')
    expect(ghost()?.dataset.valid).toBe('true')
    expect(said()).toMatch(/^Clock picked up at column 5, row 4\./)
    expect(document.activeElement).toBe(clockBox())
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('KeyboardMoved holds the Clock two columns and a row from where it was', async () => {
    const { restore, set } = await runStory(stories.KeyboardMoved as unknown as KeyStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('5 / span 4'))
    expect(ghost()?.style.gridRow).toBe('4 / span 2')
    expect(ghost()?.dataset.valid).toBe('true')
    expect(said()).toBe('Column 5, row 4.')
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('KeyboardResizing holds the Clock three columns wide and a row taller', async () => {
    const { restore, set } = await runStory(stories.KeyboardResizing as unknown as KeyStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 6'))
    expect(ghost()?.style.gridRow).toBe('3 / span 3')
    expect(clockBox()?.style.gridColumn).toBe('3 / span 6')
    expect(said()).toBe('6 columns by 3 rows.')
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('KeyboardResizeStopsAtLimits keeps the Clock at its largest width, and says so', async () => {
    const { restore } = await runStory(stories.KeyboardResizeStopsAtLimits as unknown as KeyStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('3 / span 8'))
    expect(said()).toBe('8 columns by 2 rows. Largest size.')
    restore()
  })

  it('KeyboardRefused holds the Clock over the Weather: the outline is refused, and it says so', async () => {
    const { restore, set } = await runStory(stories.KeyboardRefused as unknown as KeyStory)

    await waitFor(() => expect(ghost()?.dataset.valid).toBe('false'))
    expect(ghost()?.style.gridColumn).toBe('8 / span 4')
    expect(said()).toBe('Column 8, row 1. Another widget is there.')
    expect(set).not.toHaveBeenCalled()
    restore()
  })

  it('KeyboardGridEdge holds the Clock at the left edge, and says so', async () => {
    const { restore } = await runStory(stories.KeyboardGridEdge as unknown as KeyStory)

    await waitFor(() => expect(ghost()?.style.gridColumn).toBe('1 / span 4'))
    expect(said()).toBe('Column 1, row 3. Edge of the grid.')
    restore()
  })
})
