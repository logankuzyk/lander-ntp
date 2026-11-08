import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { menuNote } from '@/components/AddMenu/availability'
import { EditModeProvider } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import { deriveLayout } from '@/layout/derive'
import { addWidget } from '@/layout/ops'
import type { Layout } from '@/layout/types'
import { DEFAULT_SETTINGS } from '@/settings/schema'

import { Controls } from './Controls'

/** A new install's Layout: the Clock alone, in the middle. */
const NEW_INSTALL = deriveLayout(DEFAULT_SETTINGS)

/** Both off, as an update from 0.2.3 with the Clock and the Weather off leaves it. */
const BOTH_OFF = deriveLayout({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
})

/** A stored Clock of any size, which the check keeps as it is. */
const clock = (id: string, col: number, row: number, w: number, h = 4) => ({
  col,
  h,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w,
})

const storedLayout = (...widgets: ReturnType<typeof clock>[]): Layout =>
  checkLayout({ v: 1, widgets })

const renderControls = ({
  canChange = true,
  layout = NEW_INSTALL,
  loaded = true,
}: { canChange?: boolean; layout?: Layout; loaded?: boolean } = {}) => {
  const onCommit = vi.fn()
  const tree = (current: Layout) => (
    <EditModeProvider canChange={canChange}>
      <Controls
        layout={current}
        layoutLoaded={loaded}
        onCommit={onCommit}
        onNext={vi.fn()}
        onToggleInfo={vi.fn()}
        onToggleSettings={vi.fn()}
      />
    </EditModeProvider>
  )
  const view = render(tree(layout))
  return { onCommit, rerender: (next: Layout) => view.rerender(tree(next)) }
}

const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
const addButton = () => screen.getByRole('button', { name: 'Add' })
const menu = () => screen.getByRole('menu', { name: 'Add a widget' })
const item = (name: RegExp | string) => within(menu()).getByRole('menuitem', { name })
const openMenu = () => {
  edit()
  fireEvent.click(addButton())
}

describe('Controls, the Add button', () => {
  it('is not there outside edit mode, and joins Done beside it in edit mode', () => {
    renderControls()
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()

    edit()

    const buttons = screen.getAllByRole('button')
    const names = buttons.map((button) => button.getAttribute('aria-label'))
    expect(names.indexOf('Add')).toBe(names.indexOf('Done') - 1)
    expect(addButton().getAttribute('title')).toBe('Add (A)')
    expect(addButton().getAttribute('aria-haspopup')).toBe('menu')
    expect(addButton().getAttribute('aria-expanded')).toBe('false')
    // What a callout points at.
    expect(addButton().getAttribute('data-callout-target')).toBe('add')
  })

  it('goes again when edit mode ends', () => {
    renderControls()
    edit()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull()
  })
})

describe('Controls, the Add menu', () => {
  it('lists the registry’s Widgets by name, in a menu, with focus on the first', () => {
    renderControls()

    openMenu()

    expect(addButton().getAttribute('aria-expanded')).toBe('true')
    expect(
      within(menu())
        .getAllByRole('menuitem')
        .map((el) => el.textContent),
    ).toEqual(['Clock', 'Date', 'Analog clock', 'Weather', 'Quick dial'])
    expect(document.activeElement).toBe(item('Clock'))
    // Each is something a callout can point at.
    expect(item('Clock').getAttribute('data-callout-target')).toBe('menu:clock')
    expect(item('Date').getAttribute('data-callout-target')).toBe('menu:date')
    expect(item('Analog clock').getAttribute('data-callout-target')).toBe('menu:analog-clock')
    expect(item('Weather').getAttribute('data-callout-target')).toBe('menu:weather')
    expect(item('Quick dial').getAttribute('data-callout-target')).toBe('menu:quick-dial')
  })

  it('opens with the A key in edit mode, and not outside it', () => {
    renderControls()

    fireEvent.keyDown(window, { key: 'a' })
    expect(screen.queryByRole('menu')).toBeNull()

    edit()
    fireEvent.keyDown(window, { key: 'a' })

    expect(menu()).toBeTruthy()
    expect(document.activeElement).toBe(item('Clock'))
  })

  it('ignores A typed in a field, with a modifier, or inside a popover', () => {
    renderControls()
    edit()
    render(
      <>
        <input aria-label="Search" />
        <aside aria-label="Options" class="popover" role="dialog">
          <button type="button">Inside</button>
        </aside>
      </>,
    )

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'a' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Inside' }), { key: 'a' })
    fireEvent.keyDown(window, { ctrlKey: true, key: 'a' })
    fireEvent.keyDown(window, { key: 'a', metaKey: true })
    fireEvent.keyDown(window, { altKey: true, key: 'a' })
    fireEvent.keyDown(window, { key: 'A', shiftKey: true })

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('does nothing for A outside edit mode, and leaves the menu shut when edit mode starts', () => {
    renderControls()

    fireEvent.keyDown(window, { key: 'a' })
    fireEvent.keyDown(window, { key: 'e' })

    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(addButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('is shut, not only gone, the next time edit mode starts', () => {
    renderControls()
    openMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    edit()

    expect(screen.queryByRole('menu')).toBeNull()
    expect(addButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('moves with the arrow keys, wrapping, and with Home and End', () => {
    renderControls()
    openMenu()

    fireEvent.keyDown(item('Clock'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Date'))
    fireEvent.keyDown(item('Date'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Analog clock'))
    fireEvent.keyDown(item('Analog clock'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Weather'))
    fireEvent.keyDown(item('Weather'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Quick dial'))
    fireEvent.keyDown(item('Quick dial'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Clock'))
    fireEvent.keyDown(item('Clock'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(item('Quick dial'))
    fireEvent.keyDown(item('Quick dial'), { key: 'Home' })
    expect(document.activeElement).toBe(item('Clock'))
    fireEvent.keyDown(item('Clock'), { key: 'End' })
    expect(document.activeElement).toBe(item('Quick dial'))
  })

  it('does not change the photo, or anything else, from the arrow keys inside it', () => {
    const onNext = vi.fn()
    render(
      <EditModeProvider>
        <Controls
          layout={NEW_INSTALL}
          layoutLoaded
          onCommit={vi.fn()}
          onNext={onNext}
          onToggleSettings={vi.fn()}
        />
      </EditModeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(addButton())

    fireEvent.keyDown(item('Clock'), { key: 'ArrowRight' })
    fireEvent.keyDown(item('Clock'), { key: 'e' })
    fireEvent.keyDown(item('Clock'), { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
    // Edit mode is still on: E did not leave it.
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('closes on Escape without leaving edit mode, and puts focus back on Add', () => {
    renderControls()
    openMenu()

    const escape = fireEvent.keyDown(item('Clock'), { key: 'Escape' })

    // preventDefault: nothing further along answers it.
    expect(escape).toBe(false)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(document.activeElement).toBe(addButton())
    expect(addButton().getAttribute('aria-expanded')).toBe('false')

    // The next Escape is edit mode's.
    fireEvent.keyDown(addButton(), { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('closes on a press elsewhere, and on pressing Add again', () => {
    renderControls()
    openMenu()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(addButton())
    expect(screen.queryByRole('menu')).not.toBeNull()
    fireEvent.pointerDown(addButton())
    fireEvent.click(addButton())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes when edit mode ends', () => {
    renderControls()
    openMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Controls, picking a Widget', () => {
  it('commits the Layout with a new Widget, once, and closes the menu', () => {
    const { onCommit } = renderControls()
    openMenu()

    fireEvent.click(item('Weather'))

    expect(onCommit).toHaveBeenCalledOnce()
    const [next] = onCommit.mock.calls[0] as [Layout]
    expect(next.widgets.map((widget) => widget.kind === 'known' && widget.placed.type)).toEqual([
      'clock',
      'weather',
    ])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('picks with Enter from the keyboard', () => {
    const { onCommit } = renderControls()
    openMenu()

    fireEvent.keyDown(item('Clock'), { key: 'ArrowDown' })
    fireEvent.click(item('Weather'))

    expect(onCommit).toHaveBeenCalledOnce()
  })

  it('allows any number of one type: a second Clock', () => {
    const { onCommit } = renderControls()
    openMenu()

    fireEvent.click(item('Clock'))

    const [next] = onCommit.mock.calls[0] as [Layout]
    expect(next.widgets).toHaveLength(2)
  })

  it('says it again when a second one of the same kind is added at once', () => {
    renderControls()
    openMenu()
    fireEvent.click(item('Weather'))
    const live = () => document.querySelector('[aria-live="polite"]')?.textContent ?? ''
    const first = live()

    fireEvent.click(addButton())
    fireEvent.click(item('Weather'))

    // A live region says what changes: the same text again would be silent.
    expect(live()).not.toBe(first)
    expect(live().replaceAll('​', '')).toBe('Weather added.')
  })

  it('says what was added, politely', () => {
    renderControls()
    openMenu()

    fireEvent.click(item('Weather'))

    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Weather added.')
  })
})

describe('Controls, a Widget with no room', () => {
  // Four Clocks cover the Grid: no cell is left for either.
  const FULL = storedLayout(
    clock('clock0aa', 1, 1, 8),
    clock('clock0bb', 9, 1, 4),
    clock('clock0cc', 1, 5, 8),
    clock('clock0dd', 9, 5, 4),
  )

  it('makes the item unavailable, still focusable, with the reason beside it', () => {
    const { onCommit } = renderControls({ layout: FULL })
    openMenu()

    const weather = item(/Weather/)
    expect(weather.getAttribute('aria-disabled')).toBe('true')
    expect(weather.getAttribute('disabled')).toBeNull()
    expect(weather.textContent).toContain('There is no room for a Weather.')
    expect(item(/Clock/).textContent).toContain('There is no room for a Clock.')
    // Focus can reach it, so the reason is read.
    weather.focus()
    expect(document.activeElement).toBe(weather)

    fireEvent.click(weather)
    fireEvent.keyDown(weather, { key: 'Enter' })

    expect(onCommit).not.toHaveBeenCalled()
    // The menu stays open: nothing was picked.
    expect(screen.queryByRole('menu')).not.toBeNull()
  })

  it('leaves the other item available when only that one has no room', () => {
    // Only columns 9 and 10 of rows 5 and 6 are left: room for a Weather (2 by 2) and not for a
    // Clock (3 by 2 at the least).
    const layout = storedLayout(
      clock('clock0aa', 1, 1, 8),
      clock('clock0bb', 9, 1, 4),
      clock('clock0cc', 1, 5, 8),
      clock('clock0dd', 11, 5, 2),
      clock('clock0ee', 9, 7, 2, 2),
    )
    renderControls({ layout })
    openMenu()

    expect(item(/Clock/).getAttribute('aria-disabled')).toBe('true')
    expect(item(/Weather/).getAttribute('aria-disabled')).toBeNull()
  })

  it('reads the reason once: in the item, not again as a description of it', () => {
    renderControls({ layout: FULL })
    openMenu()

    const weather = item(/Weather/)
    expect(weather.getAttribute('aria-describedby')).toBeNull()
    expect(weather.textContent).toContain('There is no room for a Weather.')
  })
})

describe('Controls, at the Widget limit', () => {
  /** The whole menu: its title and line, and its items. */
  const popup = () => menu().parentElement as HTMLElement

  const LINE = "That's all 8 widgets. Remove one to add another."

  const weather = (id: string, col: number, row: number) => ({
    col,
    h: 2,
    id,
    options: {},
    row,
    type: 'weather',
    w: 2,
  })

  /** `n` Weathers along the top and bottom edges, with the middle free for more. */
  const weathers = (n: number): Layout =>
    checkLayout({
      v: 1,
      widgets: [
        weather('weather1', 1, 1),
        weather('weather2', 3, 1),
        weather('weather3', 9, 1),
        weather('weather4', 11, 1),
        weather('weather5', 1, 7),
        weather('weather6', 3, 7),
        weather('weather7', 9, 7),
        weather('weather8', 11, 7),
        weather('weather9', 5, 7),
      ].slice(0, n),
    })

  it('says nothing before the limit: seven widgets, every item available', () => {
    renderControls({ layout: weathers(7) })
    openMenu()

    expect(popup().textContent).not.toContain('widgets')
    expect(item('Clock').getAttribute('aria-disabled')).toBeNull()
    expect(item('Date').getAttribute('aria-disabled')).toBeNull()
    expect(item('Weather').getAttribute('aria-disabled')).toBeNull()
  })

  it('opens the menu from a usable Add button, with the line beside the title', () => {
    renderControls({ layout: weathers(8) })
    edit()

    expect(addButton().hasAttribute('disabled')).toBe(false)
    expect(addButton().getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(addButton())

    const header = popup().querySelector('.add-menu__header')
    expect(header?.textContent).toBe(`Add a widget${LINE}`)
    expect(header?.querySelector('.add-menu__note')?.textContent).toBe(LINE)
  })

  it('makes every item unavailable but focusable, and adds nothing when pressed', () => {
    const { onCommit } = renderControls({ layout: weathers(8) })
    openMenu()

    for (const name of ['Clock', 'Date', 'Weather']) {
      const el = item(name)
      expect(el.getAttribute('aria-disabled')).toBe('true')
      expect(el.hasAttribute('disabled')).toBe(false)
      el.focus()
      expect(document.activeElement).toBe(el)
      fireEvent.click(el)
      fireEvent.keyDown(el, { key: 'Enter' })
    }

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeNull()
  })

  it('has room for another at eight, so that the limit is what stops it', () => {
    const result = addWidget({ layout: weathers(8), readOnly: false }, 'clock', undefined, null)
    expect(result.ok).toBe(true)
  })

  it('reads the line once: described by the menu, not again by each item or by a live region', () => {
    renderControls({ layout: weathers(8) })
    openMenu()

    const note = menu().getAttribute('aria-describedby')
    expect(note).not.toBeNull()
    expect(document.getElementById(note ?? '')?.textContent).toBe(LINE)
    expect(document.body.textContent?.split(LINE)).toHaveLength(2)
    for (const el of within(menu()).getAllByRole('menuitem')) {
      expect(el.getAttribute('aria-describedby')).toBeNull()
      expect(el.textContent).not.toContain('widgets')
    }
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('')
  })

  it('stays unavailable for a Layout of nine, which loaded whole, and is back at seven', () => {
    const view = renderControls({ layout: weathers(9) })
    openMenu()
    expect(item('Clock').getAttribute('aria-disabled')).toBe('true')
    view.rerender(weathers(8))
    expect(item('Clock').getAttribute('aria-disabled')).toBe('true')

    view.rerender(weathers(7))

    expect(item('Clock').getAttribute('aria-disabled')).toBeNull()
    expect(popup().textContent).not.toContain(LINE)
    fireEvent.click(item('Clock'))
    expect(view.onCommit).toHaveBeenCalledOnce()
  })

  it('says the limit rather than no room when the Grid is full as well', () => {
    const full = checkLayout({
      v: 1,
      widgets: Array.from({ length: 8 }, (_, i) =>
        clock(`clock${i}`.padEnd(8, '0'), 1 + (i % 4) * 3, 1 + Math.floor(i / 4) * 4, 3),
      ),
    })
    renderControls({ layout: full })
    openMenu()

    expect(popup().textContent).toContain(LINE)
    expect(popup().textContent).not.toContain('no room')
  })

  it('does not apply when the limit is null', () => {
    const editable = { layout: weathers(9), readOnly: false }
    expect(menuNote(editable, null)).toBeNull()
    expect(menuNote(editable)).toBe(LINE)
    expect(menuNote({ layout: weathers(7), readOnly: false })).toBeNull()
  })
})

describe('Controls, when the Layout cannot be changed', () => {
  it('makes every item unavailable while the stored Layout has not arrived', () => {
    const { onCommit } = renderControls({ loaded: false })
    openMenu()

    expect(item('Clock').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item('Clock'))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('makes every item unavailable while the Layout is read-only', () => {
    const { onCommit } = renderControls({ canChange: false })
    openMenu()

    expect(item('Clock').getAttribute('aria-disabled')).toBe('true')
    expect(item('Weather').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(item('Weather'))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('offers a Clock on an empty Grid, as an update with the Clock off finds it', () => {
    const { onCommit } = renderControls({ layout: BOTH_OFF })
    openMenu()

    fireEvent.click(item('Clock'))

    const [next] = onCommit.mock.calls[0] as [Layout]
    expect(next.widgets).toHaveLength(1)
  })
})
