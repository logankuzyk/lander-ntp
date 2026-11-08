import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'

import { Grid } from './Grid'

// A pointer pressed on a Widget that is picked up from the keyboard: the keyboard's pick-up ends
// (the Widget goes back, nothing is written) and the pointer's drag goes on from where the Widget
// was, so the two are never in the air at once. The Grid is 1200 by 800 pixels at the window's top
// left (happy-dom measures nothing): a cell is 100 by 100.
const GRID = { height: 800, left: 0, top: 0, width: 1200 }
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

function Editing() {
  const { editing, enter } = useEditMode()
  return editing ? null : (
    <button onClick={enter} type="button">
      start
    </button>
  )
}

function setup() {
  const commit = vi.fn()
  const view = render(
    <EditModeProvider>
      <Editing />
      <Grid commit={commit} layout={LAYOUT} page={PAGE} />
    </EditModeProvider>,
  )
  fireEvent.click(screen.getByText('start'))
  const box = () => view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
  const handle = () => box().querySelector<HTMLElement>('.widget-box__resize')!
  const ghost = () => view.container.querySelector<HTMLElement>('.grid__ghost')
  const said = () => view.container.querySelector('.grid + [aria-live="polite"]')?.textContent ?? ''
  return { box, commit, ghost, handle, said }
}

const key = (el: Element, name: string, extra: KeyboardEventInit = {}) =>
  fireEvent.keyDown(el, { key: name, ...extra })

const MOUSE = { button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse' }
const press = (el: Element, x: number, y: number) =>
  fireEvent.pointerDown(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const drag = (el: Element, x: number, y: number) =>
  fireEvent.pointerMove(el, { ...MOUSE, buttons: 1, clientX: x, clientY: y })
const release = (el: Element, x: number, y: number) =>
  fireEvent.pointerUp(el, { ...MOUSE, clientX: x, clientY: y })

function placeOf(layout: Layout, id: string) {
  const widget = layout.widgets.find((w) => w.kind !== 'malformed' && w.placed.id === id)
  if (!widget || widget.kind === 'malformed') throw new Error(`no ${id}`)
  const { col, h, row, w } = widget.placed
  return { col, h, row, w }
}

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
  // A drag swallows the click that follows it until the next task.
  await new Promise((resolve) => setTimeout(resolve, 0))
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Grid, a pointer pressed on a Widget that is picked up from the keyboard', () => {
  it('puts the keyboard’s pick-up back, and the drag goes on from where the Widget was', () => {
    const { box, commit, ghost, said } = setup()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowDown')
    key(box(), 'ArrowDown')
    expect(box().style.gridRow).toBe('6 / span 2')

    // The press is on the middle of the Widget where it was stored (x 600, y 400), though it is
    // held two rows lower: the frame already has focus, so nothing else ends the pick-up.
    act(() => {
      press(box(), 600, 400)
    })
    expect(box().classList.contains('widget-box--held')).toBe(false)
    expect(box().style.gridColumn).toBe('5 / span 4')
    expect(box().style.gridRow).toBe('4 / span 2')
    expect(ghost()).toBeNull()
    expect(said()).toBe('Clock put back at column 5, row 4.')

    // One column left and one row up from the press: a drag, from the place it was put back to.
    drag(box(), 590, 380)
    drag(box(), 500, 300)
    expect(ghost()?.style.gridColumn).toBe('4 / span 4')
    expect(ghost()?.style.gridRow).toBe('3 / span 2')
    release(box(), 500, 300)

    expect(commit).toHaveBeenCalledTimes(1)
    expect(placeOf(commit.mock.calls[0]?.[0] as Layout, 'clock0001')).toEqual({
      col: 4,
      h: 2,
      row: 3,
      w: 4,
    })
    expect(box().classList.contains('widget-box--held')).toBe(false)
  })

  it('does not put the Widget down a second time: Enter after the drag picks it up again, and writes nothing', () => {
    const { box, commit } = setup()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowDown')
    key(box(), 'ArrowDown')
    press(box(), 600, 400)
    drag(box(), 500, 300)
    release(box(), 500, 300)
    expect(commit).toHaveBeenCalledTimes(1)

    key(box(), 'Enter')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(box().classList.contains('widget-box--held')).toBe(true)
  })

  it('shows only the pointer’s outline while it drags, never the keyboard’s', () => {
    const { box, ghost } = setup()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowDown')
    key(box(), 'ArrowDown')
    press(box(), 600, 400)
    drag(box(), 700, 400)
    drag(box(), 800, 400)
    // Two columns right of where it was stored: not the keyboard's column 5, row 6.
    expect(ghost()?.style.gridColumn).toBe('7 / span 4')
    expect(ghost()?.style.gridRow).toBe('4 / span 2')
    release(box(), 800, 400)
  })

  it('puts the keyboard’s pick-up back for a press on the resize handle, and the resize goes on', () => {
    const { box, commit, handle, said } = setup()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowRight', { shiftKey: true })
    key(box(), 'ArrowDown')
    expect(box().style.gridColumn).toBe('5 / span 5')
    expect(box().style.gridRow).toBe('5 / span 2')

    // The handle is just inside the stored bottom right corner (800, 500).
    act(() => {
      press(handle(), 790, 490)
    })
    expect(box().classList.contains('widget-box--held')).toBe(false)
    expect(box().style.gridColumn).toBe('5 / span 4')
    expect(box().style.gridRow).toBe('4 / span 2')
    expect(said()).toBe('Clock put back at column 5, row 4.')

    drag(handle(), 890, 590)
    release(handle(), 890, 590)

    expect(commit).toHaveBeenCalledTimes(1)
    expect(placeOf(commit.mock.calls[0]?.[0] as Layout, 'clock0001')).toEqual({
      col: 5,
      h: 3,
      row: 4,
      w: 5,
    })
    expect(box().classList.contains('widget-box--held')).toBe(false)
  })

  it('does the same for a touch or a pen: any press on the Grid ends the keyboard’s pick-up', () => {
    const { box, commit } = setup()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowDown')
    act(() => {
      fireEvent.pointerDown(box(), {
        button: 0,
        buttons: 1,
        clientX: 600,
        clientY: 400,
        isPrimary: true,
        pointerId: 2,
        pointerType: 'touch',
      })
    })
    expect(box().classList.contains('widget-box--held')).toBe(false)
    expect(commit).not.toHaveBeenCalled()
  })

  it('leaves a pointer press with no keyboard pick-up alone', () => {
    const { box, commit, said } = setup()
    press(box(), 600, 400)
    release(box(), 600, 400)
    expect(commit).not.toHaveBeenCalled()
    expect(said()).not.toMatch(/put back/)
  })
})
