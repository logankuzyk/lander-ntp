import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import { deriveLayout } from '@/layout/derive'
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
  render(
    <EditModeProvider canChange={canChange}>
      <Controls
        layout={layout}
        layoutLoaded={loaded}
        onCommit={onCommit}
        onNext={vi.fn()}
        onToggleInfo={vi.fn()}
        onToggleSettings={vi.fn()}
      />
    </EditModeProvider>,
  )
  return { onCommit }
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
    ).toEqual(['Clock', 'Weather'])
    expect(document.activeElement).toBe(item('Clock'))
    // Each is something a callout can point at.
    expect(item('Clock').getAttribute('data-callout-target')).toBe('menu:clock')
    expect(item('Weather').getAttribute('data-callout-target')).toBe('menu:weather')
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
    expect(document.activeElement).toBe(item('Weather'))
    fireEvent.keyDown(item('Weather'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Clock'))
    fireEvent.keyDown(item('Clock'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(item('Weather'))
    fireEvent.keyDown(item('Weather'), { key: 'Home' })
    expect(document.activeElement).toBe(item('Clock'))
    fireEvent.keyDown(item('Clock'), { key: 'End' })
    expect(document.activeElement).toBe(item('Weather'))
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

  it('still adds at eight widgets: the Widget limit is not this menu’s to check yet', () => {
    const weather = (id: string, col: number, row: number) => ({
      col,
      h: 2,
      id,
      options: {},
      row,
      type: 'weather',
      w: 2,
    })
    // Eight Weathers along the top and bottom edges, with the middle free.
    const eight = checkLayout({
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
      ],
    })
    const { onCommit } = renderControls({ layout: eight })
    openMenu()

    expect(item('Clock').getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(item('Clock'))

    const [next] = onCommit.mock.calls[0] as [Layout]
    expect(next.widgets).toHaveLength(9)
  })

  it('offers a Clock on an empty Grid, as an update with the Clock off finds it', () => {
    const { onCommit } = renderControls({ layout: BOTH_OFF })
    openMenu()

    fireEvent.click(item('Clock'))

    const [next] = onCommit.mock.calls[0] as [Layout]
    expect(next.widgets).toHaveLength(1)
  })
})
