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

const clock = (id: string, col: number, row: number, w = 4, h = 2) => ({
  col,
  h,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w,
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
/** The Clock with room all round it: columns 2 to 5, rows 2 and 3 (x 100 to 500, y 100 to 300). */
const ROOMY = layoutOf(clock('clock0001', 2, 2), weather('wthr0001', 11, 1))
/** The Weather right of the Clock, one column between them: columns 3 to 6 and 8 and 9, rows 4 and 5. */
const BESIDE = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))

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
  const handle = (type: string) =>
    box(type).querySelector<HTMLElement>('.widget-box__resize') as HTMLElement
  return { box, commit: onCommit as ReturnType<typeof vi.fn>, grid, handle, view }
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

// The handle of the Clock at columns 5 to 8, rows 4 and 5, is just inside its bottom right corner
// (800, 500): the pointer is pressed 10 pixels in each way, so the corner is 10 away from it.
const HANDLE = { x: 790, y: 490 }

/** The size the Widget has in a Layout a commit was given. */
function sizeOf(layout: Layout, id: string) {
  const widget = layout.widgets.find((w) => w.kind !== 'malformed' && w.placed.id === id)
  if (!widget || widget.kind === 'malformed') throw new Error(`no ${id}`)
  const { col, h, row, w } = widget.placed
  return { col, h, row, w }
}

const resizing = (el: Element) => el.classList.contains('widget-box--resizing')
const moving = (el: Element) => el.classList.contains('widget-box--moving')

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
  // A resize swallows the click that follows it until the next task (see useGridMove): let that
  // pass, or the next test's first click would be the one swallowed.
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Grid, the resize handle', () => {
  it('is on every Widget it can resize in edit mode, as a round mark that is not a control', () => {
    const { handle } = setup()
    for (const type of ['clock', 'weather']) {
      expect(handle(type)).not.toBeNull()
      // Pointer only: the keyboard has its own way (W23), and Tab has enough stops.
      expect(handle(type).getAttribute('aria-hidden')).toBe('true')
      expect(handle(type).tagName).not.toBe('BUTTON')
      expect(handle(type).getAttribute('tabindex')).toBeNull()
    }
  })

  it('is not there outside edit mode', () => {
    const { view } = setup(LAYOUT, { editing: false })
    expect(view.container.querySelector('.widget-box__resize')).toBeNull()
  })

  it('is not there on a Layout that may not be changed', () => {
    const { view } = setup(LAYOUT, { canChange: false })
    expect(view.container.querySelector('.widget-box__resize')).toBeNull()
  })

  it('is not on a Widget of a type this version does not know, which has no sizes', () => {
    const future = layoutOf({ ...clock('futr0001', 5, 4), type: 'bookmarks' }, weather('w', 11, 1))
    const { box } = setup(future)
    expect(box('bookmarks').querySelector('.widget-box__resize')).toBeNull()
    expect(box('weather').querySelector('.widget-box__resize')).not.toBeNull()
  })

  it('says a Widget can be dragged and resized by the Grid’s class, and hides the handle without it', () => {
    const { grid } = setup()
    expect(grid().classList.contains('grid--movable')).toBe(true)
    expect(rule('.widget-box__resize')).toMatch(/display:\s*none/)
    expect(rule('.grid--movable .widget-box__resize')).toMatch(/display:\s*grid/)
  })

  it('does not hide the Options and remove buttons’ corners: it is the bottom right', () => {
    const body = rule('.widget-box__resize')
    expect(body).toMatch(/bottom:/)
    expect(body).toMatch(/right:/)
    expect(body).not.toMatch(/\btop:|\bleft:/)
  })
})

describe('Grid, resizing a Widget by its handle', () => {
  it('saves once on release however many times the pointer moved, and none before', () => {
    const { commit, handle } = setup()
    const grab = handle('clock')
    press(grab, HANDLE.x, HANDLE.y)
    for (let step = 1; step <= 20; step++) drag(grab, HANDLE.x + step * 10, HANDLE.y + step * 5)
    expect(commit).not.toHaveBeenCalled()

    // The corner was 10 from the pointer, so the pointer at (990, 590) puts it at (1000, 600):
    // column lines 10 and 6, which makes the Clock 6 wide (columns 5 to 10) and 3 high.
    drag(grab, 990, 590)
    release(grab, 990, 590)
    expect(commit).toHaveBeenCalledTimes(1)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 3, row: 4, w: 6 })
    expect(sizeOf(next, 'wthr0001')).toEqual({ col: 11, h: 2, row: 1, w: 2 })
  })

  it('saves exactly the stored shape: only the size of the Widget resized has changed', () => {
    const { commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(stored(next)).toEqual(
      stored(layoutOf(clock('clock0001', 5, 4, 6, 3), weather('wthr0001', 11, 1))),
    )
  })

  it('saves nothing for a press and release in place, or for a nudge too small to be a resize', () => {
    const { commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    release(handle('clock'), HANDLE.x, HANDLE.y)
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), HANDLE.x + 2, HANDLE.y - 1)
    release(handle('clock'), HANDLE.x + 2, HANDLE.y - 1)
    expect(commit).not.toHaveBeenCalled()
    expect(resizing(handle('clock').parentElement!)).toBe(false)
    expect(document.querySelector('.grid__ghost')).toBeNull()
  })

  it('shows what size the Widget will be while it is held, and takes it away on release', () => {
    const { box, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)

    expect(resizing(box('clock'))).toBe(true)
    const ghost = document.querySelector<HTMLElement>('.grid__ghost')
    expect(ghost?.style.gridColumn).toBe('5 / span 6')
    expect(ghost?.style.gridRow).toBe('4 / span 3')
    expect(ghost?.dataset.valid).toBe('true')
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')

    release(handle('clock'), 990, 590)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(resizing(box('clock'))).toBe(false)
  })

  it('redraws the outline as the size changes, not only when it first shows', () => {
    const { handle } = setup()
    const ghostSpans = () => {
      const ghost = document.querySelector<HTMLElement>('.grid__ghost')
      return [ghost?.style.gridColumn, ghost?.style.gridRow]
    }
    press(handle('clock'), HANDLE.x, HANDLE.y)
    // The first move past the threshold is still the size it had.
    drag(handle('clock'), HANDLE.x + 5, HANDLE.y)
    expect(ghostSpans()).toEqual(['5 / span 4', '4 / span 2'])
    drag(handle('clock'), 990, HANDLE.y)
    expect(ghostSpans()).toEqual(['5 / span 6', '4 / span 2'])
    drag(handle('clock'), 990, 590)
    expect(ghostSpans()).toEqual(['5 / span 6', '4 / span 3'])
    drag(handle('clock'), 690, 590)
    expect(ghostSpans()).toEqual(['5 / span 3', '4 / span 3'])
  })

  it('has the Widget grow exactly with the pointer, not cell by cell, from the same top left corner', () => {
    const { box, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 950, 560)
    // The corner is at (960, 570): 560 across from the box's left (400) and 270 down from its top (300).
    expect(box('clock').style.width).toBe('560px')
    expect(box('clock').style.height).toBe('270px')
    // It is not moved: its cells and its place are as they were.
    expect(box('clock').style.transform).toBe('')
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    release(handle('clock'), 950, 560)
    expect(box('clock').style.width).toBe('')
    expect(box('clock').style.height).toBe('')
  })

  it('does not jump when the handle is pressed: the corner stays where it was until the pointer moves', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    // The least that is a resize, back on the grab: still the size it had.
    drag(handle('clock'), HANDLE.x + 5, HANDLE.y)
    expect(box('clock').style.width).toBe('405px')
    release(handle('clock'), HANDLE.x + 5, HANDLE.y)
    expect(commit).not.toHaveBeenCalled()
  })

  it('shrinks too, down to the smallest size and no further', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 590, 390)
    // 2 columns and 1 row would be under the Clock’s smallest, 3 by 2: it stops there.
    expect(box('clock').style.width).toBe('300px')
    expect(box('clock').style.height).toBe('200px')
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.style.gridColumn).toBe('5 / span 3')
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('true')
    release(handle('clock'), 590, 390)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 2, row: 4, w: 3 })
  })

  it('stops at the smallest size however far back the pointer goes, even past the top left', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), -300, -300)
    expect(box('clock').style.width).toBe('300px')
    expect(box('clock').style.height).toBe('200px')
    release(handle('clock'), -300, -300)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 2, row: 4, w: 3 })
  })

  it('stops at the largest size however far out the pointer goes, off the Grid and the page', () => {
    // The Clock at column 2, row 2 has the room, so only its largest, 8 by 4, stops it.
    const { box, commit, handle } = setup(ROOMY)
    const grab = handle('clock')
    // The Clock's corner is (500, 300); the handle is pressed 10 in.
    press(grab, 490, 290)
    drag(grab, 5000, 5000)
    expect(box('clock').style.width).toBe('800px')
    expect(box('clock').style.height).toBe('400px')
    const ghost = document.querySelector<HTMLElement>('.grid__ghost')
    expect([ghost?.style.gridColumn, ghost?.style.gridRow]).toEqual(['2 / span 8', '2 / span 4'])
    expect(ghost?.dataset.valid).toBe('true')
    release(document.body, 5000, 5000)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 2, h: 4, row: 2, w: 8 })
  })

  it('reaches the largest size from a place with exactly that much room', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 5000, 5000)
    // From column 5 there are 8 columns (the largest), and 5 rows from row 4 (more than the 4 it may).
    expect(box('clock').style.width).toBe('800px')
    expect(box('clock').style.height).toBe('400px')
    release(handle('clock'), 5000, 5000)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 4, row: 4, w: 8 })
  })

  it('stops at the Grid’s edge when that is nearer than the largest size', () => {
    // From column 9 there are four columns and from row 7 two rows; the Clock could be 8 by 4.
    const { box, commit, handle } = setup(layoutOf(clock('clock0001', 9, 7, 3, 2)))
    press(handle('clock'), 1190, 790)
    drag(handle('clock'), 5000, 5000)
    expect(box('clock').style.width).toBe('400px')
    expect(box('clock').style.height).toBe('200px')
    release(handle('clock'), 5000, 5000)
    expect(commit).toHaveBeenCalledTimes(1)
    const [last] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(last, 'clock0001')).toEqual({ col: 9, h: 2, row: 7, w: 4 })
  })

  it('draws the outline refused over a neighbour, and a release there saves nothing', () => {
    const { box, commit, handle } = setup(BESIDE)
    // The Clock’s corner is (600, 500); the Weather starts at x 700. The handle is pressed 10 in.
    press(handle('clock'), 590, 490)
    drag(handle('clock'), 890, 490)
    // The corner at x 900: columns 3 to 9 take the Weather’s two columns.
    const ghost = document.querySelector<HTMLElement>('.grid__ghost')
    expect(ghost?.style.gridColumn).toBe('3 / span 7')
    expect(ghost?.dataset.valid).toBe('false')

    release(handle('clock'), 890, 490)
    expect(commit).not.toHaveBeenCalled()
    // Back where it was: no outline, no error shown.
    expect(box('clock').style.width).toBe('')
    expect(box('clock').style.gridColumn).toBe('3 / span 4')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('allows a size that only touches the neighbour, and is allowed again once back from it', () => {
    const { handle } = setup(BESIDE)
    press(handle('clock'), 590, 490)
    // The corner at x 700: columns 3 to 7, which only touch the Weather’s column 8.
    drag(handle('clock'), 690, 490)
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('true')
    drag(handle('clock'), 890, 490)
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('false')
    drag(handle('clock'), 690, 490)
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.dataset.valid).toBe('true')
  })

  it('counts a column and a row by their own sizes: cells that are not square', () => {
    // 1200 by 640: a column is 100 pixels wide and a row is 80 high. The Clock is at y 240 to 400.
    GRID = { height: 640, left: 0, top: 0, width: 1200 }
    const { box, commit, handle } = setup()
    press(handle('clock'), 790, 390)
    // One column right and one row down.
    drag(handle('clock'), 890, 470)
    expect(box('clock').style.width).toBe('500px')
    expect(box('clock').style.height).toBe('240px')
    expect(document.querySelector<HTMLElement>('.grid__ghost')?.style.gridRow).toBe('4 / span 3')
    release(handle('clock'), 890, 470)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 3, row: 4, w: 5 })
  })

  it('takes the pointer for the Widget, so it keeps it when the pointer leaves the box', () => {
    const { box, handle } = setup()
    const capture = vi.spyOn(box('clock'), 'setPointerCapture')
    press(handle('clock'), HANDLE.x, HANDLE.y)
    expect(capture).not.toHaveBeenCalled()
    drag(handle('clock'), 900, 600)
    expect(capture).toHaveBeenCalledWith(1)
  })

  it('starts the next resize from the Layout the last one saved', () => {
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
    const handle = (type: string) =>
      view.container.querySelector<HTMLElement>(
        `.widget-box[data-widget="${type}"] .widget-box__resize`,
      )!
    const boxOf = (type: string) =>
      view.container.querySelector<HTMLElement>(`.widget-box[data-widget="${type}"]`)!

    // 4 wide to 6 wide: columns 5 to 10, which is next to the Weather (column 11) in rows 1 and 2.
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 490)
    release(handle('clock'), 990, 490)
    expect(saved).toHaveLength(1)
    expect(boxOf('clock').style.gridColumn).toBe('5 / span 6')
    expect(boxOf('clock').style.width).toBe('')

    // Another from the new size: a Clock 6 wide at its handle, which has moved with it.
    press(handle('clock'), 990, 490)
    drag(handle('clock'), 890, 490)
    release(handle('clock'), 890, 490)
    expect(saved).toHaveLength(2)
    expect(sizeOf(saved[1]!, 'clock0001')).toEqual({ col: 5, h: 2, row: 4, w: 5 })
  })
})

describe('Grid, how far a press on the handle goes before it is a resize', () => {
  const PRESS_AT = HANDLE

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
  ])('%s moved %d px: a resize is %s', (pointerType, distance, started) => {
    const { box, handle } = setup()
    press(handle('clock'), PRESS_AT.x, PRESS_AT.y, { pointerType })
    drag(handle('clock'), PRESS_AT.x + distance, PRESS_AT.y, { pointerType })
    expect(resizing(box('clock'))).toBe(started)
  })

  it('counts the distance across and down together', () => {
    const { box, handle } = setup()
    // 3 across and 3 down is 4.24: a resize for a mouse, though neither is 4 on its own.
    press(handle('clock'), PRESS_AT.x, PRESS_AT.y)
    drag(handle('clock'), PRESS_AT.x + 3, PRESS_AT.y + 3)
    expect(resizing(box('clock'))).toBe(true)
  })
})

describe('Grid, a press on the handle and a press on the Widget are not each other', () => {
  it('does not move the Widget when the handle is pressed and dragged', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), HANDLE.x - 200, HANDLE.y - 100)
    expect(moving(box('clock'))).toBe(false)
    expect(box('clock').style.transform).toBe('')
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    release(handle('clock'), HANDLE.x - 200, HANDLE.y - 100)
    const [next] = commit.mock.calls[0] as [Layout]
    // The size changed, the place did not.
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 5, h: 2, row: 4, w: 3 })
  })

  it('does not resize the Widget when its body is pressed and dragged', () => {
    const { box, commit } = setup()
    // Even from just beside the handle: it is the handle’s own element that starts a resize.
    press(box('clock'), 780, 480)
    drag(box('clock'), 980, 580)
    expect(resizing(box('clock'))).toBe(false)
    expect(moving(box('clock'))).toBe(true)
    expect(box('clock').style.width).toBe('')
    expect(box('clock').style.height).toBe('')
    release(box('clock'), 980, 580)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001')).toEqual({ col: 7, h: 2, row: 5, w: 4 })
  })

  it('holds one Widget at a time: a second press on another handle is not a second resize', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 900, 590)
    // A second finger on the Weather’s handle.
    press(handle('weather'), 1190, 190, { isPrimary: false, pointerId: 2 })
    drag(handle('weather'), 1100, 100, { isPrimary: false, pointerId: 2 })
    expect(resizing(box('weather'))).toBe(false)
    release(handle('weather'), 1100, 100, { isPrimary: false, pointerId: 2 })
    release(handle('clock'), 900, 590)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('starts only for the main button', () => {
    const { commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y, { button: 2 })
    drag(handle('clock'), 990, 590)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(handle('clock'), 990, 590)
    expect(commit).not.toHaveBeenCalled()
  })

  it('swallows the click a browser sends after a resize, and only that one', async () => {
    const { box, handle } = setup()
    const onClick = vi.fn()
    box('clock').addEventListener('click', onClick)
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    fireEvent.click(handle('clock'))
    expect(onClick).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 5))
    fireEvent.click(box('clock'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not resize outside edit mode or on a Layout that may not be changed', () => {
    const outside = setup(LAYOUT, { editing: false })
    expect(outside.view.container.querySelector('.widget-box__resize')).toBeNull()
    press(outside.box('clock'), HANDLE.x, HANDLE.y)
    drag(outside.box('clock'), 990, 590)
    release(outside.box('clock'), 990, 590)
    expect(outside.commit).not.toHaveBeenCalled()
    cleanup()

    const locked = setup(LAYOUT, { canChange: false })
    press(locked.box('clock'), HANDLE.x, HANDLE.y)
    drag(locked.box('clock'), 990, 590)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(locked.box('clock').style.width).toBe('')
    release(locked.box('clock'), 990, 590)
    expect(locked.commit).not.toHaveBeenCalled()
  })
})

describe('Grid, Escape during a resize', () => {
  it('puts the Widget back at its size and saves nothing, and edit mode stays on', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)

    const escape = fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(escape).toBe(false) // handled: preventDefault was called
    expect(box('clock').style.width).toBe('')
    expect(box('clock').style.height).toBe('')
    expect(resizing(box('clock'))).toBe(false)
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()

    // The pointer is still down: nothing it does now resizes or saves.
    drag(handle('clock'), 1090, 590)
    release(handle('clock'), 1090, 590)
    expect(commit).not.toHaveBeenCalled()
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(box('clock').style.width).toBe('')

    // The next Escape, with nothing in the air, leaves edit mode as it always did.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('does not hear Escape once the resize is over', () => {
    const { handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    release(handle('clock'), 990, 590)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })
})

describe('Grid, a resize that the page changes under', () => {
  it('puts the Widget back when edit mode ends', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(document.querySelector('.grid__ghost')).toBeNull()
    expect(box('clock').style.width).toBe('')
    expect(resizing(box('clock'))).toBe(false)
    release(document.body, 990, 590)
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
    const grab = view.container.querySelector<HTMLElement>(
      '.widget-box[data-widget="clock"] .widget-box__resize',
    )!
    press(grab, HANDLE.x, HANDLE.y)
    drag(grab, 990, 590)
    expect(document.querySelector('.grid__ghost')).not.toBeNull()

    view.rerender(
      <EditModeProvider>
        <Editing />
        <Grid commit={commit} layout={layoutOf(weather('wthr0001', 11, 1))} page={PAGE} />
      </EditModeProvider>,
    )
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(document.body, 990, 590)
    expect(commit).not.toHaveBeenCalled()
  })

  it('saves nothing for a size onto where another tab put a Widget meanwhile', () => {
    const commit = vi.fn()
    const view = render(
      <EditModeProvider>
        <Editing />
        <Grid commit={commit} layout={LAYOUT} page={PAGE} />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('start'))
    const grab = view.container.querySelector<HTMLElement>(
      '.widget-box[data-widget="clock"] .widget-box__resize',
    )!
    press(grab, HANDLE.x, HANDLE.y)
    drag(grab, 990, 590)
    view.rerender(
      <EditModeProvider>
        <Editing />
        <Grid
          commit={commit}
          layout={layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 9, 4))}
          page={PAGE}
        />
      </EditModeProvider>,
    )
    release(grab, 990, 590)
    expect(commit).not.toHaveBeenCalled()
  })

  it('puts the Widget back and stops listening when the Grid goes away in the middle of a resize', () => {
    const { box, commit, handle, view } = setup()
    const clockBox = box('clock')
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    expect(resizing(clockBox)).toBe(true)

    view.unmount()
    expect(resizing(clockBox)).toBe(false)
    expect(clockBox.style.width).toBe('')
    expect(clockBox.style.height).toBe('')
    // Nothing is listening for the rest of the press.
    drag(document.body, 1090, 590)
    release(document.body, 1090, 590)
    expect(commit).not.toHaveBeenCalled()
    expect(resizing(clockBox)).toBe(false)
  })
})

describe('Grid, a resize that leaves the Grid', () => {
  it('is a resize when the first move past the threshold is outside the Grid', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    // The Bottom bar: the pointer is on the page, not on the Grid.
    drag(document.body, HANDLE.x, 850)
    expect(resizing(box('clock'))).toBe(true)
    release(document.body, HANDLE.x, 850)
    expect(commit).toHaveBeenCalledTimes(1)
    const [next] = commit.mock.calls[0] as [Layout]
    expect(sizeOf(next, 'clock0001').h).toBe(4)
  })

  it('is ended by a release outside the Grid before it was a resize: the Widget does not follow after', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    release(document.body, HANDLE.x, 850)
    drag(handle('clock'), 990, 590)
    expect(resizing(box('clock'))).toBe(false)
    expect(commit).not.toHaveBeenCalled()
  })

  it('is ended by a mouse move with no button down: a release that was never seen', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    expect(resizing(box('clock'))).toBe(true)

    drag(handle('clock'), 1090, 590, { buttons: 0 })
    expect(resizing(box('clock'))).toBe(false)
    expect(box('clock').style.width).toBe('')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    // It does not start again by itself when the button comes back down elsewhere.
    drag(handle('clock'), 1000, 590)
    expect(resizing(box('clock'))).toBe(false)
    release(handle('clock'), 1000, 590)
    expect(commit).not.toHaveBeenCalled()
  })

  it('still follows a touch, which reports no button', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y, { pointerType: 'touch' })
    drag(handle('clock'), 990, 590, { buttons: 0, pointerType: 'touch' })
    expect(resizing(box('clock'))).toBe(true)
    release(handle('clock'), 990, 590, { pointerType: 'touch' })
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('puts the Widget back, with nothing saved, if the browser takes the pointer away', () => {
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), 990, 590)
    fireEvent.pointerCancel(handle('clock'), { ...MOUSE, clientX: 990, clientY: 590 })
    expect(box('clock').style.width).toBe('')
    expect(document.querySelector('.grid__ghost')).toBeNull()
    release(handle('clock'), 990, 590)
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, resizing with reduced motion', () => {
  it('has the Widget jump from size to size instead of following the pointer', () => {
    reduced.matches = true
    const { box, commit, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    // 140 across and 30 down from the grab: 5.4 columns and 2.3 rows, which snap to 5 and 2.
    drag(handle('clock'), HANDLE.x + 140, HANDLE.y + 30)
    expect(box('clock').style.width).toBe('500px')
    expect(box('clock').style.height).toBe('200px')
    drag(handle('clock'), HANDLE.x + 160, HANDLE.y + 30)
    expect(box('clock').style.width).toBe('600px')
    release(handle('clock'), HANDLE.x + 160, HANDLE.y + 30)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('is watched live: a change of mind in the middle of a resize changes how it moves', () => {
    const { box, handle } = setup()
    press(handle('clock'), HANDLE.x, HANDLE.y)
    drag(handle('clock'), HANDLE.x + 140, HANDLE.y)
    expect(box('clock').style.width).toBe('540px')
    act(() => reduced.set(true))
    drag(handle('clock'), HANDLE.x + 142, HANDLE.y)
    expect(box('clock').style.width).toBe('500px')
    act(() => reduced.set(false))
    drag(handle('clock'), HANDLE.x + 144, HANDLE.y)
    expect(box('clock').style.width).toBe('544px')
  })
})

describe('the styles of a resize', () => {
  it('shows the diagonal cursor on the handle, and lifts the Widget being resized above the others', () => {
    expect(rule('.widget-box__resize')).toMatch(/cursor:\s*nwse-resize/)
    expect(rule('.widget-box.widget-box--resizing')).toMatch(/z-index:\s*[1-9]/)
  })

  it('has no transition on the Widget being resized, which follows the pointer', () => {
    expect(rule('.widget-box.widget-box--resizing')).not.toMatch(/transition/)
  })

  it('lets the box be the size the pointer says, from its top left, past the cells it is in', () => {
    const body = rule('.widget-box.widget-box--resizing')
    expect(body).toMatch(/justify-self:\s*start/)
    expect(body).toMatch(/align-self:\s*start/)
  })

  it('keeps the name clear of the handle, which shares its row', () => {
    // The name is at the bottom left and may run to the handle's edge, not under it.
    expect(rule('.widget-box__name')).toMatch(/max-width:\s*calc\(100% - 3rem\)/)
  })

  it('keeps the handle clear of the Options and remove buttons in a box as narrow as the smallest on a phone', () => {
    const start = css.indexOf('@container (max-width: 4.5rem) {')
    const narrow = css.slice(start, css.indexOf('\n}\n', start))
    expect(narrow).toMatch(/\.widget-box__resize/)
    expect(narrow).toMatch(/\.widget-box__name/)
  })

  it('is a bigger target than it looks, so a finger can find it', () => {
    expect(rule('.widget-box__resize::after')).toMatch(/inset:\s*-/)
  })
})
