import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Controls } from '@/components/Controls/Controls'
import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout, storedLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'
import { css, rule } from '@/test/styles'

import { Grid } from './Grid'

// The Grid is 1200 by 800 pixels at the window's top left in these tests (happy-dom measures
// nothing), so a cell is 100 by 100: column c is at x = 100 (c - 1), row r at y = 100 (r - 1).
let GRID = { height: 800, left: 0, top: 0, width: 1200 }
const PAGE = { hour12: false }

const clock = (id: string, col: number, row: number) => ({
  col,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w: 4,
})

const weather = (id: string, col: number, row: number) => ({
  col,
  h: 2,
  id,
  options: {
    followDevice: false,
    place: { latitude: 48.43, longitude: -123.37, name: 'Victoria' },
  },
  row,
  type: 'weather',
  w: 2,
})

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })

/** The Clock at columns 5 to 8, rows 4 and 5 (x 400 to 800, y 300 to 500), the Weather top right. */
const LAYOUT = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

const stored = (layout: Layout) => JSON.parse(JSON.stringify(storedLayout(layout))) as unknown

function Editing() {
  const { editing, enter } = useEditMode()
  return editing ? null : (
    <button onClick={enter} type="button">
      start
    </button>
  )
}

type Setup = { canChange?: boolean; commit?: (next: Layout) => void; editing?: boolean }

function setup(layout: Layout = LAYOUT, { canChange = true, commit, editing = true }: Setup = {}) {
  const onCommit = commit ?? vi.fn()
  const view = render(
    <EditModeProvider canChange={canChange}>
      <Editing />
      <Grid commit={onCommit} layout={layout} page={PAGE} />
      <Controls
        layout={layout}
        layoutLoaded
        onCommit={() => {}}
        onNext={() => {}}
        onToggleSettings={() => {}}
      />
    </EditModeProvider>,
  )
  if (editing) fireEvent.click(screen.getByText('start'))
  const grid = () => view.container.querySelector<HTMLElement>('.grid')!
  const box = (type: string) =>
    view.container.querySelector<HTMLElement>(`.widget-box[data-widget="${type}"]`)!
  return { box, commit: onCommit as ReturnType<typeof vi.fn>, grid, view }
}

const MOUSE = { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' }
// A pointer that is pressed has its button down, as it does in a browser: `buttons` is 1 on the
// press and every move, and 0 on the release.
const press = (el: Element, x: number, y: number, extra = {}) =>
  fireEvent.pointerDown(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y, ...extra })
const drag = (el: Element, x: number, y: number, extra = {}) =>
  fireEvent.pointerMove(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y, ...extra })
const release = (el: Element, x: number, y: number, extra = {}) =>
  fireEvent.pointerUp(el, { ...MOUSE, clientX: x, clientY: y, ...extra })

/** What the Clock's place is in the Layout a commit was given. */
function placeOf(layout: Layout, id: string) {
  const widget = layout.widgets.find((w) => w.kind !== 'malformed' && w.placed.id === id)
  if (!widget || widget.kind === 'malformed') throw new Error(`no ${id}`)
  const { col, row } = widget.placed
  return { col, row }
}

let reduced: { matches: boolean; set: (value: boolean) => void }

beforeEach(() => {
  GRID = { height: 800, left: 0, top: 0, width: 1200 }
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
  // A window that can ask for reduced motion, and change its mind.
  const listeners = new Set<() => void>()
  reduced = {
    matches: false,
    set(value) {
      this.matches = value
      for (const listener of listeners) listener()
    },
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    get matches() {
      return query.includes('reduce') && reduced.matches
    },
    media: query,
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
})

afterEach(async () => {
  // A drag swallows the click that follows it until the next task (see useGridMove): let that
  // pass, or the next test's first click would be the one swallowed.
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Grid, dragging a Widget in edit mode', () => {
  it('saves once on release however many times the pointer moved, and none before', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    for (let step = 1; step <= 20; step++) drag(clockBox, 450 - step * 5, 350 + step * 2)
    expect(commit).not.toHaveBeenCalled()

    // The Clock was grabbed 50 in and 50 down. With the pointer at (350, 450) its corner is at
    // (300, 400): the cell at column 4, row 5.
    drag(clockBox, 350, 450)
    release(clockBox, 350, 450)
    expect(commit).toHaveBeenCalledTimes(1)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(placeOf(next, 'clock0001')).toEqual({ col: 4, row: 5 })
    expect(placeOf(next, 'wthr0001')).toEqual({ col: 11, row: 1 })
  })

  it('saves nothing for a press and release in place, or for a nudge too small to be a drag', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    release(clockBox, 450, 350)
    press(clockBox, 450, 350)
    drag(clockBox, 452, 349)
    release(clockBox, 452, 349)
    expect(commit).not.toHaveBeenCalled()
    expect(clockBox.classList.contains('widget-box--moving')).toBe(false)
    expect(document.querySelector('.grid__ghost')).toBeNull()
  })

  it('shows where the Widget will land while it is dragged, and takes it away on release', () => {
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)

    expect(clockBox.classList.contains('widget-box--moving')).toBe(true)
    const ghost = document.querySelector<HTMLElement>('.grid__ghost')
    expect(ghost?.style.gridColumn).toBe('3 / span 4')
    expect(ghost?.style.gridRow).toBe('4 / span 2')
    expect(ghost?.dataset.valid).toBe('true')
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')

    release(clockBox, 250, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(clockBox.classList.contains('widget-box--moving')).toBe(false)
  })

  it('has the Widget follow the pointer exactly, not cell by cell', () => {
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 370, 362)
    expect(clockBox.style.transform).toBe('translate(-80px, 12px)')
    release(clockBox, 370, 362)
    expect(clockBox.style.transform).toBe('')
  })

  it('draws the outline refused over another Widget, and a drop there saves nothing', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    // Up and over to the Weather's cells at the top right.
    drag(clockBox, 1150, 50)
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('false')

    release(clockBox, 1150, 50)
    expect(commit).not.toHaveBeenCalled()
    // Back where it was: not moved, no outline, no error shown.
    expect(clockBox.style.transform).toBe('')
    expect(clockBox.style.gridColumn).toBe('5 / span 4')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not let the Widget out of the Grid', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, -500, 2000)
    // The corner stops at column 1, and the last row that holds two.
    expect(clockBox.style.transform).toBe('translate(-400px, 300px)')
    release(clockBox, -500, 2000)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(placeOf(next, 'clock0001')).toEqual({ col: 1, row: 7 })
  })

  it('takes the pointer for the Widget, so it keeps it when the pointer leaves the box', () => {
    const { box } = setup()
    const clockBox = box('clock')
    const capture = vi.spyOn(clockBox, 'setPointerCapture')
    press(clockBox, 450, 350)
    expect(capture).not.toHaveBeenCalled()
    drag(clockBox, 300, 350)
    expect(capture).toHaveBeenCalledWith(1)
  })

  it('puts the Widget back, with nothing saved, if the browser takes the pointer away', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    fireEvent.pointerCancel(clockBox, { ...MOUSE, clientX: 250, clientY: 350 })
    expect(clockBox.style.transform).toBe('')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })

  it('puts the Widget back, with nothing saved, if it loses the pointer to something else', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    fireEvent.lostPointerCapture(clockBox, { ...MOUSE })
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(commit).not.toHaveBeenCalled()
  })

  it('keeps the drag when a touch lets go of the part of the box it first fell on', () => {
    // A finger is held by what it touched; taking it for the box makes the browser let go of that
    // first, and the event for it comes up through the box. It is not the box losing the pointer.
    const { box, commit } = setup()
    const clockBox = box('clock')
    const time = clockBox.querySelector('.clock__time')!
    press(time, 450, 350)
    drag(time, 250, 350)
    fireEvent.lostPointerCapture(time, { ...MOUSE })
    expect(document.querySelector('.grid__ghost')).not.toBeNull()
    release(clockBox, 250, 350)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('moves only for the pointer that pressed, and only for its main button', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350, { button: 2 })
    drag(clockBox, 250, 350)
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()

    press(clockBox, 450, 350)
    // A second finger: not this drag's.
    drag(clockBox, 100, 100, { isPrimary: false, pointerId: 2 })
    release(clockBox, 100, 100, { isPrimary: false, pointerId: 2 })
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(commit).not.toHaveBeenCalled()
    release(clockBox, 450, 350)
  })

  it('starts the next drag from the Layout the last drop saved', () => {
    // The page, as App holds it: a commit becomes the Layout the Grid is drawn from.
    function Page() {
      const [layout, setLayout] = useState(LAYOUT)
      return (
        <EditModeProvider>
          <Editing />
          <Grid
            commit={(next) => {
              saved.push(next)
              setLayout(next)
            }}
            layout={layout}
            page={PAGE}
          />
        </EditModeProvider>
      )
    }
    const saved: Layout[] = []
    const view = render(<Page />)
    fireEvent.click(screen.getByText('start'))
    const boxOf = (type: string) =>
      view.container.querySelector<HTMLElement>(`.widget-box[data-widget="${type}"]`)!

    // The Clock to columns 2 to 5, rows 4 and 5.
    press(boxOf('clock'), 450, 350)
    drag(boxOf('clock'), 150, 350)
    release(boxOf('clock'), 150, 350)
    expect(saved).toHaveLength(1)
    expect(boxOf('clock').style.gridColumn).toBe('2 / span 4')
    expect(boxOf('clock').style.transform).toBe('')

    // The Weather onto the Clock's new cells is refused: the Grid knows where the Clock is now.
    press(boxOf('weather'), 1150, 50)
    drag(boxOf('weather'), 350, 350)
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('false')
    release(boxOf('weather'), 350, 350)
    expect(saved).toHaveLength(1)

    // And onto the Clock's old cells is not (columns 5 to 6 would touch; 7 and 8 are free).
    press(boxOf('weather'), 1150, 50)
    drag(boxOf('weather'), 750, 350)
    release(boxOf('weather'), 750, 350)
    expect(saved).toHaveLength(2)
    expect(placeOf(saved[1]!, 'wthr0001')).toEqual({ col: 7, row: 4 })
    expect(placeOf(saved[1]!, 'clock0001')).toEqual({ col: 2, row: 4 })
  })
})

describe('Grid, what does not start a drag', () => {
  it('does not drag outside edit mode', () => {
    const { box, commit, grid } = setup(LAYOUT, { editing: false })
    const clockBox = box('clock')
    expect(grid().classList.contains('grid--movable')).toBe(false)
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()
    expect(document.querySelector('.grid__ghost')).toBeNull()
  })

  it('does not drag a Layout that may not be changed, and does not say it can be', () => {
    const { box, commit, grid } = setup(LAYOUT, { canChange: false })
    const clockBox = box('clock')
    expect(grid().classList.contains('grid--movable')).toBe(false)
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(clockBox.style.transform).toBe('')
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })

  it('does not drag where nothing can save the move', () => {
    const view = render(
      <EditModeProvider>
        <Editing />
        <Grid layout={LAYOUT} page={PAGE} />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('start'))
    expect(view.container.querySelector('.grid--movable')).toBeNull()
  })

  it('does not start from a button on the frame, such as Options', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    const button = document.createElement('button')
    button.className = 'widget-box__options'
    clockBox.append(button)
    press(button, 450, 350)
    drag(button, 250, 350)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(button, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })

  it('does start from the setup button, which fills a small box, and does not click it after', () => {
    const { box, commit } = setup()
    const weatherBox = box('weather')
    const setupButton = document.createElement('button')
    setupButton.className = 'widget-setup'
    const onClick = vi.fn()
    setupButton.addEventListener('click', onClick)
    weatherBox.append(setupButton)

    press(setupButton, 1150, 50)
    drag(setupButton, 650, 50)
    release(setupButton, 650, 50)
    expect(commit).toHaveBeenCalledTimes(1)
    // The click a browser sends after a drag is swallowed, so the button does not also press.
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    setupButton.dispatchEvent(click)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('leaves the next click alone', async () => {
    const { box } = setup()
    const clockBox = box('clock')
    const onClick = vi.fn()
    clockBox.addEventListener('click', onClick)
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    release(clockBox, 250, 350)
    // The swallowing lasts only for the click that follows the release.
    await new Promise((resolve) => setTimeout(resolve, 5))
    fireEvent.click(clockBox)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Grid, Escape during a drag', () => {
  it('puts the Widget back and saves nothing, and edit mode stays on', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)

    const escape = fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(escape).toBe(false) // handled: preventDefault was called
    expect(clockBox.style.transform).toBe('')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

    // The pointer is still down: nothing it does now drags or saves.
    drag(clockBox, 150, 350)
    release(clockBox, 150, 350)
    expect(commit).not.toHaveBeenCalled()
    expect(document.querySelector('.grid__ghost')).toBeNull()

    // The next Escape clears selection; one more leaves edit mode.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(clockBox.dataset.selected).toBe('false')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('does not hear Escape once the drag is over', () => {
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    release(clockBox, 250, 350)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})

describe('Grid, a drag that the page changes under', () => {
  it('puts the Widget back when edit mode ends', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(clockBox.style.transform).toBe('')
    expect(clockBox.classList.contains('widget-box--moving')).toBe(false)
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })

  it('puts the Widget back when another tab removes it', () => {
    const commit = vi.fn()
    const view = render(
      <EditModeProvider>
        <Editing />
        <Grid commit={commit} layout={LAYOUT} page={PAGE} />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('start'))
    const clockBox = view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    expect(document.querySelector('.grid__ghost')).not.toBeNull()

    view.rerender(
      <EditModeProvider>
        <Editing />
        <Grid commit={commit} layout={layoutOf(weather('wthr0001', 11, 1))} page={PAGE} />
      </EditModeProvider>,
    )
    expect(document.querySelector('.grid__ghost')).toBeNull()
  })

  it('saves nothing for a drop onto where another tab put a Widget meanwhile', () => {
    const commit = vi.fn()
    const view = render(
      <EditModeProvider>
        <Editing />
        <Grid commit={commit} layout={LAYOUT} page={PAGE} />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('start'))
    const clockBox = view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    view.rerender(
      <EditModeProvider>
        <Editing />
        <Grid
          commit={commit}
          layout={layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 3, 4))}
          page={PAGE}
        />
      </EditModeProvider>,
    )
    release(clockBox, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, with reduced motion', () => {
  it('has the Widget jump from cell to cell instead of following the pointer', () => {
    reduced.matches = true
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 370, 362)
    // 80 px left and 12 down is under a cell down and nearly one across: one cell left.
    expect(clockBox.style.transform).toBe('translate(-100px, 0px)')
    drag(clockBox, 330, 362)
    expect(clockBox.style.transform).toBe('translate(-100px, 0px)')
    drag(clockBox, 299, 362)
    expect(clockBox.style.transform).toBe('translate(-200px, 0px)')
    release(clockBox, 299, 362)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('is watched live: a change of mind in the middle of a drag changes how it moves', () => {
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 370, 362)
    expect(clockBox.style.transform).toBe('translate(-80px, 12px)')
    act(() => reduced.set(true))
    drag(clockBox, 372, 362)
    expect(clockBox.style.transform).toBe('translate(-100px, 0px)')
    act(() => reduced.set(false))
    drag(clockBox, 374, 362)
    expect(clockBox.style.transform).toBe('translate(-76px, 12px)')
  })
})

describe('Grid, its Layout is the page', () => {
  it('saves exactly the stored shape: only the Widget dragged has changed', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    release(clockBox, 250, 350)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 11, 1))),
    )
  })
})

describe('Grid, a press that leaves the Grid', () => {
  const moving = (el: Element) => el.classList.contains('widget-box--moving')

  it('is a drag when the first move past the threshold is outside the Grid, in the margin or the Bottom bar', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    // The Bottom bar: the pointer is on the page, not on the Grid.
    drag(document.body, 450, 850)
    expect(moving(clockBox)).toBe(true)
    expect(document.querySelector('.grid__ghost')).not.toBeNull()
    release(document.body, 450, 850)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('is ended by a release outside the Grid: the Widget is not left to follow the pointer', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    // Released before it was a drag, away from the Grid.
    press(clockBox, 450, 350)
    release(document.body, 450, 850)
    drag(clockBox, 250, 350)
    expect(moving(clockBox)).toBe(false)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(commit).not.toHaveBeenCalled()
  })

  it('drops at the last place it was held at when a drag is released outside the Grid', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    release(document.body, 250, 950)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(moving(clockBox)).toBe(false)
    // And it is over: a hover afterwards moves nothing.
    drag(clockBox, 150, 350, { buttons: 0 })
    expect(moving(clockBox)).toBe(false)
  })

  it('is ended by a mouse move with no button down: a release that was never seen', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    expect(moving(clockBox)).toBe(true)

    drag(clockBox, 200, 350, { buttons: 0 })
    expect(moving(clockBox)).toBe(false)
    expect(clockBox.style.transform).toBe('')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    // It does not start again by itself when the button comes back down elsewhere.
    drag(clockBox, 150, 350)
    expect(moving(clockBox)).toBe(false)
    release(clockBox, 150, 350)
    expect(commit).not.toHaveBeenCalled()
  })

  it('is not started by a move with no button down, for a mouse or a pen', () => {
    for (const pointerType of ['mouse', 'pen']) {
      const { box } = setup()
      const clockBox = box('clock')
      press(clockBox, 450, 350, { pointerType })
      drag(clockBox, 250, 350, { buttons: 0, pointerType })
      expect(moving(clockBox)).toBe(false)
      cleanup()
    }
  })

  it('still follows a touch, which reports no button', () => {
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350, { pointerType: 'touch' })
    drag(clockBox, 250, 350, { buttons: 0, pointerType: 'touch' })
    expect(moving(clockBox)).toBe(true)
    release(clockBox, 250, 350, { pointerType: 'touch' })
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('puts the Widget back when the Grid goes away in the middle of a drag, and stops listening', () => {
    const { box, commit, view } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 350)
    drag(clockBox, 250, 350)
    expect(moving(clockBox)).toBe(true)

    view.unmount()
    expect(moving(clockBox)).toBe(false)
    expect(clockBox.style.transform).toBe('')
    // Nothing is listening for the rest of the press.
    release(document.body, 250, 350)
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, how far a press goes before it is a drag', () => {
  const moving = (el: Element) => el.classList.contains('widget-box--moving')
  const PRESS_AT = { x: 450, y: 350 }

  // Mouse and pen: 4 pixels. A finger: 10, as it wobbles more while it only means to press.
  it.each([
    ['mouse', 3.9, false],
    ['mouse', 4, true],
    ['mouse', 4.1, true],
    ['mouse', 9.9, true],
    ['pen', 3.9, false],
    ['pen', 4, true],
    ['pen', 4.1, true],
    ['touch', 4.1, false],
    ['touch', 7, false],
    ['touch', 9.9, false],
    ['touch', 10, true],
    ['touch', 10.1, true],
  ])('%s moved %d px: a drag is %s', (pointerType, distance, started) => {
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, PRESS_AT.x, PRESS_AT.y, { pointerType })
    drag(clockBox, PRESS_AT.x + distance, PRESS_AT.y, { pointerType })
    expect(moving(clockBox)).toBe(started)
  })

  it('counts the distance across and down together', () => {
    const { box } = setup()
    const clockBox = box('clock')
    // 3 across and 3 down is 4.24: a drag for a mouse, though neither is 4 on its own.
    press(clockBox, PRESS_AT.x, PRESS_AT.y)
    drag(clockBox, PRESS_AT.x + 3, PRESS_AT.y + 3)
    expect(moving(clockBox)).toBe(true)
  })
})

describe('Grid, which Widgets and cells it drags', () => {
  it('says a Widget can be dragged, in edit mode, on a Layout that can be changed', () => {
    const { grid } = setup()
    expect(grid().classList.contains('grid--movable')).toBe(true)
    expect(grid().classList.contains('grid--editing')).toBe(true)
  })

  it('drags a Widget of a type this version does not know', () => {
    const layout = layoutOf(
      { ...clock('futr0001', 5, 4), options: { colour: 'teal' }, type: 'future-widget' },
      weather('wthr0001', 11, 1),
    )
    const { box, commit } = setup(layout)
    const futureBox = box('future-widget')
    expect(futureBox.dataset.widgetId).toBe('futr0001')

    press(futureBox, 450, 350)
    drag(futureBox, 250, 350)
    release(futureBox, 250, 350)

    expect(commit).toHaveBeenCalledTimes(1)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(placeOf(next, 'futr0001')).toEqual({ col: 3, row: 4 })
  })

  it('counts a column and a row by their own sizes: cells that are not square', () => {
    // 1200 by 640: a column is 100 pixels wide and a row is 80 high. The Clock is at y 240 to 400.
    GRID = { height: 640, left: 0, top: 0, width: 1200 }
    const { box, commit } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 300)
    // One column right and one row down.
    drag(clockBox, 550, 380)
    expect(clockBox.style.transform).toBe('translate(100px, 80px)')
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.style.gridRow).toBe('5 / span 2')
    release(clockBox, 550, 380)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(placeOf(next, 'clock0001')).toEqual({ col: 6, row: 5 })
  })

  it('has the Widget jump by whole columns and rows of their own sizes under reduced motion', () => {
    GRID = { height: 640, left: 0, top: 0, width: 1200 }
    reduced.matches = true
    const { box } = setup()
    const clockBox = box('clock')
    press(clockBox, 450, 300)
    drag(clockBox, 540, 370)
    expect(clockBox.style.transform).toBe('translate(100px, 80px)')
  })
})

describe('the styles of a drag', () => {
  it('stops a touch scrolling the page instead of dragging, only where a drag can start', () => {
    expect(rule('.grid--movable .widget-box')).toMatch(/touch-action:\s*none/)
    // Not on every frame: a Layout that may not be changed keeps the browser's own touch.
    expect(css).not.toMatch(/\.grid--editing \.widget-box\s*{[^}]*touch-action/)
  })

  it('does not let the outline or the Widget being moved catch the pointer, or select text', () => {
    expect(rule('.grid__ghost')).toMatch(/pointer-events:\s*none/)
    expect(rule('.grid--movable .widget-box')).toMatch(/user-select:\s*none/)
  })

  it('draws the refused outline apart from the allowed one by more than its colour', () => {
    const allowed = rule(".grid__ghost[data-valid='true']")
    const refused = rule(".grid__ghost[data-valid='false']")
    expect(refused).toMatch(/dashed/)
    expect(allowed).not.toMatch(/dashed/)
  })

  it('lifts the Widget being moved above the others', () => {
    expect(rule('.widget-box.widget-box--moving')).toMatch(/z-index:\s*[1-9]/)
  })

  it('has no transition on the Widget being moved, which follows the pointer', () => {
    expect(rule('.widget-box.widget-box--moving')).not.toMatch(/transition/)
  })
})
