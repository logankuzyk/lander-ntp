import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Controls } from '@/components/Controls/Controls'
import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'
import { rule } from '@/test/styles'

import { Grid } from './Grid'

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

/** The Clock at columns 5 to 8, rows 4 and 5, and the Weather in the top right corner. */
const LAYOUT = layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 11, 1))

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
  const onNext = vi.fn()
  const view = render(
    <EditModeProvider canChange={canChange}>
      <Editing />
      <Grid commit={onCommit} layout={layout} page={PAGE} />
      <Controls
        layout={layout}
        layoutLoaded
        onCommit={() => {}}
        onNext={onNext}
        onToggleSettings={() => {}}
      />
    </EditModeProvider>,
  )
  if (editing) fireEvent.click(screen.getByText('start'))
  const box = (type: string) =>
    view.container.querySelector<HTMLElement>(`.widget-box[data-widget="${type}"]`)!
  const ghost = () => view.container.querySelector<HTMLElement>('.grid__ghost')
  // The Grid's own live region, which follows the Grid (the Add menu has one of its own).
  const said = () => view.container.querySelector('.grid + [aria-live="polite"]')?.textContent ?? ''
  return { box, commit: onCommit as ReturnType<typeof vi.fn>, ghost, onNext, said, view }
}

/** A key pressed on `el`, as a browser sends it: keydown first, then keyup. */
function key(el: Element, name: string, extra: KeyboardEventInit = {}) {
  const down = fireEvent.keyDown(el, { key: name, ...extra })
  fireEvent.keyUp(el, { key: name, ...extra })
  return down
}

const held = (el: Element) => el.classList.contains('widget-box--held')

/** The Layout a commit was given, as the places its Widgets are at. */
function placesIn(layout: Layout) {
  return Object.fromEntries(
    layout.widgets.flatMap((w) =>
      w.kind === 'malformed'
        ? []
        : [[w.placed.id, { col: w.placed.col, h: w.placed.h, row: w.placed.row, w: w.placed.w }]],
    ),
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: () => {},
    matches: false,
    removeEventListener: () => {},
  }))
})

describe('Grid, picking a Widget up from the keyboard', () => {
  it('picks the focused Widget up with Enter, and says so and how to put it down', () => {
    const { box, commit, ghost, said } = setup()
    box('clock').focus()

    key(box('clock'), 'Enter')

    expect(held(box('clock'))).toBe(true)
    expect(said()).toBe(
      'Clock picked up at column 5, row 4. Arrow keys move it, Enter puts it down, Escape puts it back. Shift with the arrow keys resizes it.',
    )
    // The outline of where it would land is where it is.
    expect(ghost()?.style.gridColumn).toBe('5 / span 4')
    expect(ghost()?.style.gridRow).toBe('4 / span 2')
    expect(ghost()?.dataset.valid).toBe('true')
    expect(commit).not.toHaveBeenCalled()
  })

  it('picks it up with Space too, and Space does not scroll the page', () => {
    const { box } = setup()
    box('clock').focus()
    const notPrevented = key(box('clock'), ' ')
    expect(held(box('clock'))).toBe(true)
    expect(notPrevented).toBe(false)
  })

  it('names a Widget as its box does, so two of a type can be told apart', () => {
    const { box, said } = setup()
    box('weather').focus()
    key(box('weather'), 'Enter')
    expect(said()).toMatch(/^Weather, Victoria picked up at column 11, row 1\./)
  })

  it('ignores a held key’s repeats, so holding Enter does not pick up and put down', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter', { repeat: true })
    expect(held(box('clock'))).toBe(false)
    key(box('clock'), 'Enter')
    key(box('clock'), 'Enter', { repeat: true })
    expect(held(box('clock'))).toBe(true)
    expect(commit).not.toHaveBeenCalled()
  })

  it('does nothing for Enter pressed on something inside the Widget, which is that thing’s', () => {
    const { box } = setup()
    const inner = document.createElement('button')
    box('clock').append(inner)
    inner.focus()
    key(inner, 'Enter')
    expect(held(box('clock'))).toBe(false)
  })

  it('does nothing outside edit mode', () => {
    const { box } = setup(LAYOUT, { editing: false })
    key(box('clock'), 'Enter')
    expect(held(box('clock'))).toBe(false)
  })

  it('does nothing on a Layout that may not be changed', () => {
    const { box, said } = setup(LAYOUT, { canChange: false })
    key(box('clock'), 'Enter')
    expect(held(box('clock'))).toBe(false)
    expect(said()).not.toMatch(/picked up/)
  })

  it('does nothing without somewhere to save the result', () => {
    const view = render(
      <EditModeProvider>
        <Editing />
        <Grid layout={LAYOUT} page={PAGE} />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByText('start'))
    const clockBox = view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
    key(clockBox, 'Enter')
    expect(held(clockBox)).toBe(false)
  })
})

describe('Grid, moving a picked-up Widget with the arrow keys', () => {
  it('moves it a cell at a time, says the place each time, and saves nothing yet', () => {
    const { box, commit, ghost, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')

    key(box('clock'), 'ArrowRight')
    expect(said()).toBe('Column 6, row 4.')
    expect(box('clock').style.gridColumn).toBe('6 / span 4')
    expect(ghost()?.style.gridColumn).toBe('6 / span 4')

    key(box('clock'), 'ArrowDown')
    expect(said()).toBe('Column 6, row 5.')
    key(box('clock'), 'ArrowLeft')
    key(box('clock'), 'ArrowUp')
    expect(said()).toBe('Column 5, row 4.')
    expect(commit).not.toHaveBeenCalled()
  })

  it('saves nothing however many times it is moved, then once when it is put down', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 20; i++) key(box('clock'), i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    key(box('clock'), 'ArrowRight')
    expect(commit).not.toHaveBeenCalled()

    key(box('clock'), 'Enter')

    expect(commit).toHaveBeenCalledTimes(1)
    const next = commit.mock.calls[0]?.[0] as Layout
    expect(placesIn(next).clock0001).toEqual({ col: 6, h: 2, row: 4, w: 4 })
    expect(placesIn(next).wthr0001).toEqual({ col: 11, h: 2, row: 1, w: 2 })
  })

  it('puts it down with Space as well', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), ' ')
    key(box('clock'), 'ArrowDown')
    key(box('clock'), ' ')
    expect(commit).toHaveBeenCalledTimes(1)
    expect(held(box('clock'))).toBe(false)
  })

  it('says it was put down, where, and keeps focus on the Widget', () => {
    const { box, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')

    key(box('clock'), 'Enter')

    expect(said()).toBe('Clock put down at column 6, row 4.')
    expect(held(box('clock'))).toBe(false)
    expect(document.activeElement).toBe(box('clock'))
  })

  it('saves nothing for a Widget put down where it was picked up, and says so', () => {
    const { box, commit, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')
    key(box('clock'), 'ArrowLeft')
    key(box('clock'), 'Enter')
    expect(commit).not.toHaveBeenCalled()
    expect(said()).toBe('Clock put down where it was.')
    expect(held(box('clock'))).toBe(false)
  })

  it('stops at the Grid’s edge and says so', () => {
    const { box, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 6; i++) key(box('clock'), 'ArrowLeft')
    expect(box('clock').style.gridColumn).toBe('1 / span 4')
    expect(said()).toBe('Column 1, row 4. Edge of the grid.')
  })

  it('keeps arrows to a Widget that is not picked up: they do nothing to it', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), 'ArrowLeft')
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, a picked-up Widget refused over a neighbour', () => {
  it('goes red over the Weather, says it is blocked, and puts down nothing with Enter', () => {
    const { box, commit, ghost, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 3; i++) key(box('clock'), 'ArrowUp')
    for (let i = 0; i < 3; i++) key(box('clock'), 'ArrowRight')

    expect(ghost()?.dataset.valid).toBe('false')
    // The Widget's own ring goes dashed and red too (it covers the outline's edge), so that the
    // refusal does not depend on seeing the wash.
    expect(box('clock').dataset.refused).toBe('true')
    expect(said()).toBe('Column 8, row 1. Another widget is there.')

    key(box('clock'), 'Enter')

    // Still in the air: it can be moved on or put back, and nothing has been saved.
    expect(commit).not.toHaveBeenCalled()
    expect(held(box('clock'))).toBe(true)
    expect(said()).toBe("Clock can't be put down at column 8, row 1. Another widget is there.")

    key(box('clock'), 'ArrowLeft')
    expect(ghost()?.dataset.valid).toBe('true')
    expect(box('clock').dataset.refused).toBeUndefined()
    key(box('clock'), 'Enter')
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('can be walked across a neighbour to the far side', () => {
    const crowd = layoutOf(clock('clock0001', 1, 4, 3), weather('wthr0001', 4, 4))
    const { box, commit, ghost } = setup(crowd)
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 5; i++) key(box('clock'), 'ArrowRight')
    expect(ghost()?.dataset.valid).toBe('true')
    key(box('clock'), 'Enter')
    expect(placesIn(commit.mock.calls[0]?.[0] as Layout).clock0001).toMatchObject({ col: 6 })
  })
})

describe('Grid, putting a picked-up Widget back', () => {
  it('puts it back with Escape, saves nothing, says so, and does not leave edit mode', () => {
    const { box, commit, ghost, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')
    key(box('clock'), 'ArrowDown')

    key(box('clock'), 'Escape')

    expect(commit).not.toHaveBeenCalled()
    expect(held(box('clock'))).toBe(false)
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    expect(box('clock').style.gridRow).toBe('4 / span 2')
    expect(ghost()).toBeNull()
    expect(said()).toBe('Clock put back at column 5, row 4.')
    expect(document.activeElement).toBe(box('clock'))
    // Still editing: the Done button is still there, and a second Escape leaves.
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    key(box('clock'), 'Escape')
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('puts it back when focus leaves the Widget, as Tab does', () => {
    const { box, commit, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')

    act(() => screen.getByRole('button', { name: 'Done' }).focus())

    expect(commit).not.toHaveBeenCalled()
    expect(held(box('clock'))).toBe(false)
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    expect(said()).toBe('Clock put back at column 5, row 4.')
  })

  it('puts it back when edit mode ends, with nothing saved', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(commit).not.toHaveBeenCalled()
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
    expect(box('clock').classList.contains('widget-box--held')).toBe(false)
  })

  it('is put back, with nothing saved, if the Widget goes from the Layout while it is up', () => {
    const commit = vi.fn()
    function Page() {
      const [layout, setLayout] = useState(LAYOUT)
      return (
        <EditModeProvider>
          <Editing />
          <Grid commit={commit} layout={layout} page={PAGE} />
          <button onClick={() => setLayout(layoutOf(weather('wthr0001', 11, 1)))} type="button">
            another tab removes the Clock
          </button>
        </EditModeProvider>
      )
    }
    const view = render(<Page />)
    fireEvent.click(screen.getByText('start'))
    const clockBox = view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
    clockBox.focus()
    key(clockBox, 'Enter')
    key(clockBox, 'ArrowRight')
    expect(view.container.querySelector('.grid__ghost')).not.toBeNull()

    fireEvent.click(screen.getByText('another tab removes the Clock'))

    expect(view.container.querySelector('.grid__ghost')).toBeNull()
    expect(view.container.querySelector('.widget-box--held')).toBeNull()
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, resizing a picked-up Widget with Shift and the arrow keys', () => {
  const ROOMY = layoutOf(clock('clock0001', 3, 3), weather('wthr0001', 11, 1))

  it('makes it wider and taller from its top left corner, and says its size', () => {
    const { box, ghost, said } = setup(ROOMY)
    box('clock').focus()
    key(box('clock'), 'Enter')

    key(box('clock'), 'ArrowRight', { shiftKey: true })
    expect(said()).toBe('5 columns by 2 rows.')
    expect(box('clock').style.gridColumn).toBe('3 / span 5')
    expect(ghost()?.style.gridColumn).toBe('3 / span 5')

    key(box('clock'), 'ArrowDown', { shiftKey: true })
    expect(said()).toBe('5 columns by 3 rows.')
    expect(box('clock').style.gridRow).toBe('3 / span 3')

    key(box('clock'), 'ArrowLeft', { shiftKey: true })
    key(box('clock'), 'ArrowUp', { shiftKey: true })
    expect(said()).toBe('4 columns by 2 rows.')
  })

  it('stops at the largest and the smallest and says which', () => {
    const { box, said } = setup(ROOMY)
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 6; i++) key(box('clock'), 'ArrowRight', { shiftKey: true })
    expect(box('clock').style.gridColumn).toBe('3 / span 8')
    expect(said()).toBe('8 columns by 2 rows. Largest size.')
    for (let i = 0; i < 7; i++) key(box('clock'), 'ArrowLeft', { shiftKey: true })
    expect(box('clock').style.gridColumn).toBe('3 / span 3')
    expect(said()).toBe('3 columns by 2 rows. Smallest size.')
    for (let i = 0; i < 5; i++) key(box('clock'), 'ArrowDown', { shiftKey: true })
    expect(box('clock').style.gridRow).toBe('3 / span 4')
    for (let i = 0; i < 3; i++) key(box('clock'), 'ArrowUp', { shiftKey: true })
    expect(box('clock').style.gridRow).toBe('3 / span 2')
  })

  it('moves and resizes in one pick-up and saves once, when it is put down', () => {
    const { box, commit } = setup(ROOMY)
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')
    key(box('clock'), 'ArrowDown', { shiftKey: true })
    key(box('clock'), 'ArrowRight', { shiftKey: true })
    key(box('clock'), 'ArrowDown')
    expect(commit).not.toHaveBeenCalled()

    key(box('clock'), 'Enter')

    expect(commit).toHaveBeenCalledTimes(1)
    expect(placesIn(commit.mock.calls[0]?.[0] as Layout).clock0001).toEqual({
      col: 4,
      h: 3,
      row: 4,
      w: 5,
    })
  })

  it('says the size as well when it is put down resized', () => {
    const { box, said } = setup(ROOMY)
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight', { shiftKey: true })
    key(box('clock'), 'Enter')
    expect(said()).toBe('Clock put down at column 3, row 3, 5 columns by 2 rows.')
  })

  it('is refused over a neighbour, as a resize by the handle is', () => {
    const beside = layoutOf(clock('clock0001', 3, 4), weather('wthr0001', 8, 4))
    const { box, commit, ghost, said } = setup(beside)
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight', { shiftKey: true })
    expect(ghost()?.dataset.valid).toBe('true')
    key(box('clock'), 'ArrowRight', { shiftKey: true })
    expect(ghost()?.dataset.valid).toBe('false')
    expect(said()).toBe('6 columns by 2 rows. Another widget is there.')
    key(box('clock'), 'Enter')
    expect(commit).not.toHaveBeenCalled()
  })

  it('needs a pick-up first: Shift and an arrow on a Widget that is not up do nothing', () => {
    const { box, commit } = setup(ROOMY)
    box('clock').focus()
    key(box('clock'), 'ArrowRight', { shiftKey: true })
    expect(box('clock').style.gridColumn).toBe('3 / span 4')
    expect(commit).not.toHaveBeenCalled()
  })

  it('cannot resize a Widget of a type this version does not know, and says so', () => {
    const future = layoutOf({ ...clock('futr0001', 3, 3), type: 'future-widget' })
    const { box, commit, said } = setup(future)
    const unknown = box('future-widget')
    unknown.focus()
    key(unknown, 'Enter')
    expect(said()).toMatch(
      /^Unknown widget, future-widget picked up at column 3, row 3\. Arrow keys move it, Enter puts it down, Escape puts it back\.$/,
    )
    key(unknown, 'ArrowRight', { shiftKey: true })
    expect(said()).toBe("Unknown widget, future-widget can't be resized.")
    key(unknown, 'ArrowRight')
    key(unknown, 'Enter')
    expect(placesIn(commit.mock.calls[0]?.[0] as Layout).futr0001).toMatchObject({ col: 4, w: 4 })
  })
})

describe('Grid, keys that belong to a picked-up Widget', () => {
  it('keeps → from changing the photo while a Widget is up, and not before or after', () => {
    const { box, onNext } = setup()
    box('clock').focus()

    key(box('clock'), 'ArrowRight')
    expect(onNext).toHaveBeenCalledTimes(1)

    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')
    key(box('clock'), 'ArrowRight')
    expect(onNext).toHaveBeenCalledTimes(1)

    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowRight')
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('stops the arrows scrolling the page', () => {
    const { box } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    expect(key(box('clock'), 'ArrowDown')).toBe(false)
    expect(key(box('clock'), 'ArrowDown', { shiftKey: true })).toBe(false)
  })

  it('keeps the page’s other shortcuts from acting behind it: E does not leave edit mode', () => {
    const { box } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'e')
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(held(box('clock'))).toBe(true)
  })

  it('leaves the browser’s own shortcuts alone: Ctrl, Alt and Command with a key', () => {
    const { box } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    expect(key(box('clock'), 'ArrowRight', { ctrlKey: true })).toBe(true)
    expect(key(box('clock'), 'ArrowRight', { metaKey: true })).toBe(true)
    expect(box('clock').style.gridColumn).toBe('5 / span 4')
  })
})

describe('Grid, the live region', () => {
  it('is the one it already has, polite, and says the editing help until something else is said', () => {
    const { box, said, view } = setup()
    expect(view.container.querySelectorAll('.grid + [aria-live="polite"]')).toHaveLength(1)
    expect(view.container.querySelector('[role="alert"], [aria-live="assertive"]')).toBeNull()
    expect(said()).toBe('Editing widgets. Tab moves between widgets.')
    box('clock').focus()
    key(box('clock'), 'Enter')
    expect(said()).not.toMatch(/Editing widgets/)
  })

  it('is empty again outside edit mode, and says the help again when editing starts again', () => {
    const { box, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'Enter')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(said()).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(said()).toBe('Editing widgets. Tab moves between widgets.')
  })
})

describe('Grid, how a picked-up Widget looks', () => {
  it('is lifted above the other boxes, which it may be moved over', () => {
    expect(rule('.widget-box.widget-box--held')).toMatch(/z-index:\s*2/)
  })
})

/**
 * The Grid with a Layout and an edit mode that something outside can change, as another tab
 * can: `control` is filled in with what changes them.
 */
type Control = {
  setCanChange: (value: boolean) => void
  setLayout: (layout: Layout) => void
}

function Outside({ commit, control }: { commit: (next: Layout) => void; control: Control }) {
  const [layout, setLayout] = useState(LAYOUT)
  const [canChange, setCanChange] = useState(true)
  control.setLayout = setLayout
  control.setCanChange = setCanChange
  return (
    <EditModeProvider canChange={canChange}>
      <Editing />
      <Grid commit={commit} layout={layout} page={PAGE} />
    </EditModeProvider>
  )
}

function setupOutside() {
  const commit = vi.fn()
  const control: Control = { setCanChange: () => {}, setLayout: () => {} }
  const view = render(<Outside commit={commit} control={control} />)
  fireEvent.click(screen.getByText('start'))
  const box = () => view.container.querySelector<HTMLElement>('.widget-box[data-widget="clock"]')!
  const said = () => view.container.querySelector('.grid + [aria-live="polite"]')?.textContent ?? ''
  return { box, commit, control, said, view }
}

describe('Grid, a Widget picked up from the keyboard while the Layout changes under it', () => {
  it('says nothing is put back when the Widget is removed by another tab: it is gone', () => {
    const { box, commit, control, said, view } = setupOutside()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowRight')

    // A browser sends focusout as it takes the focused box out of the page: here, before it goes.
    const remove = Node.prototype.removeChild
    vi.spyOn(Node.prototype, 'removeChild').mockImplementation(function <T extends Node>(
      this: Node,
      child: T,
    ) {
      if (child instanceof HTMLElement && child.classList.contains('widget-box')) {
        child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      }
      return remove.call(this, child) as T
    })
    act(() => control.setLayout(layoutOf(weather('wthr0001', 11, 1))))

    expect(view.container.querySelector('.widget-box[data-widget="clock"]')).toBeNull()
    expect(said()).not.toMatch(/put back/)
    expect(view.container.querySelector('.grid__ghost')).toBeNull()
    expect(commit).not.toHaveBeenCalled()
  })

  it('says it could not be put down, and puts it back, when the place was taken meanwhile', () => {
    const { box, commit, control, said } = setupOutside()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowRight')
    expect(box().style.gridColumn).toBe('6 / span 4')

    // Another tab put the Weather where the Clock is going (columns 9 and 10, rows 4 and 5).
    act(() => control.setLayout(layoutOf(clock('clock0001', 5, 4), weather('wthr0001', 9, 4))))
    key(box(), 'Enter')

    expect(commit).not.toHaveBeenCalled()
    expect(said()).toBe("Clock couldn't be put down there. It went back.")
    expect(box().classList.contains('widget-box--held')).toBe(false)
    expect(box().style.gridColumn).toBe('5 / span 4')
  })

  it('is put back, and Enter puts nothing down, once the Layout may not be changed', () => {
    const { box, commit, control } = setupOutside()
    box().focus()
    key(box(), 'Enter')
    key(box(), 'ArrowRight')

    act(() => control.setCanChange(false))
    expect(box().classList.contains('widget-box--held')).toBe(false)
    key(box(), 'Enter')

    expect(commit).not.toHaveBeenCalled()
    expect(box().classList.contains('widget-box--held')).toBe(false)
    expect(box().style.gridColumn).toBe('5 / span 4')
  })
})

describe('Grid, what starts a pick-up', () => {
  it.each([
    ['Shift', { shiftKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Command', { metaKey: true }],
  ])('is not Enter or Space with %s held', (_name, modifier) => {
    const { box } = setup()
    box('clock').focus()
    // Each on its own: a second press with the modifier would put down what the first picked up.
    key(box('clock'), 'Enter', modifier)
    expect(held(box('clock'))).toBe(false)
    key(box('clock'), ' ', modifier)
    expect(held(box('clock'))).toBe(false)
    key(box('clock'), 'Enter')
    expect(held(box('clock'))).toBe(true)
  })
})

describe('Grid, resizing only the height of a picked-up Widget', () => {
  it('is put down: Shift and Down, then Enter, saves the taller Widget', () => {
    const { box, commit, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowDown', { shiftKey: true })

    key(box('clock'), 'Enter')

    expect(commit).toHaveBeenCalledTimes(1)
    expect(placesIn(commit.mock.calls[0]?.[0] as Layout).clock0001).toEqual({
      col: 5,
      h: 3,
      row: 4,
      w: 4,
    })
    expect(said()).toBe('Clock put down at column 5, row 4, 4 columns by 3 rows.')
  })

  it('is not saved when it is made taller and shorter again', () => {
    const { box, commit } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowDown', { shiftKey: true })
    key(box('clock'), 'ArrowUp', { shiftKey: true })
    key(box('clock'), 'Enter')
    expect(commit).not.toHaveBeenCalled()
  })
})

describe('Grid, the keys a picked-up Widget keeps from the page', () => {
  it.each(['Delete', 'Backspace', 'o', 'i'])(
    'does not let %s reach the page while it is up, and does when it is not',
    (name) => {
      const { box } = setup()
      const heard: string[] = []
      const listener = (event: KeyboardEvent) => heard.push(event.key)
      window.addEventListener('keydown', listener)
      box('clock').focus()

      key(box('clock'), name)
      expect(heard).toEqual([name])

      key(box('clock'), 'Enter')
      key(box('clock'), name)
      expect(heard).toEqual([name])
      expect(held(box('clock'))).toBe(true)
      window.removeEventListener('keydown', listener)
    },
  )

  it('leaves the keys it does not use, such as F5, to the browser', () => {
    const { box } = setup()
    const heard: string[] = []
    const listener = (event: KeyboardEvent) => heard.push(event.key)
    window.addEventListener('keydown', listener)
    box('clock').focus()
    key(box('clock'), 'Enter')
    key(box('clock'), 'F5')
    key(box('clock'), 'Tab')
    expect(heard).toEqual(['F5', 'Tab'])
    window.removeEventListener('keydown', listener)
  })
})

describe('Grid, saying a refusal again', () => {
  /** A Clock held over the Weather: columns 8 to 11, row 1. */
  function refused() {
    const rig = setup()
    rig.box('clock').focus()
    key(rig.box('clock'), 'Enter')
    for (let i = 0; i < 3; i++) key(rig.box('clock'), 'ArrowUp')
    for (let i = 0; i < 3; i++) key(rig.box('clock'), 'ArrowRight')
    return rig
  }

  it('changes the live region each time Enter is pressed on a refused place, so it is read again', () => {
    const { box, said } = refused()
    key(box('clock'), 'Enter')
    const first = said()
    key(box('clock'), 'Enter')
    const second = said()
    key(box('clock'), 'Enter')
    const third = said()

    expect(first).toBe("Clock can't be put down at column 8, row 1. Another widget is there.")
    // The same words (to the eye and the ear), a different string (to the live region).
    expect(second.trim()).toBe(first)
    expect(second).not.toBe(first)
    expect(third).not.toBe(second)
    expect(third.trim()).toBe(first)
  })

  it('does not change it for identical moves: the same step twice is the same words, said once', () => {
    const { box, said } = setup()
    box('clock').focus()
    key(box('clock'), 'Enter')
    for (let i = 0; i < 6; i++) key(box('clock'), 'ArrowLeft')
    const first = said()
    key(box('clock'), 'ArrowLeft')
    expect(said()).toBe(first)
    expect(first).toBe('Column 1, row 4. Edge of the grid.')
  })

  it('has the ordinary words again after the refusal is left behind', () => {
    const { box, said } = refused()
    key(box('clock'), 'Enter')
    key(box('clock'), 'Enter')
    key(box('clock'), 'ArrowLeft')
    expect(said()).toBe('Column 7, row 1.')
  })
})
