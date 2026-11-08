import { act, fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Controls } from '@/components/Controls/Controls'
import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { deriveLayout } from '@/layout/derive'
import { DEFAULT_SETTINGS } from '@/settings/schema'

import { type AddMenuControl, AddMenuControlProvider, useAddMenuControl } from './useAddMenuControl'

// The tour opens the Add menu on the person's behalf, through this handle, and shuts it again.

const NEW_INSTALL = deriveLayout(DEFAULT_SETTINGS)

let handle: AddMenuControl | null = null
let edit: ReturnType<typeof useEditMode> | null = null

function Spy() {
  handle = useAddMenuControl()
  edit = useEditMode()
  return null
}

function renderPage() {
  render(
    <EditModeProvider>
      <AddMenuControlProvider>
        <Spy />
        <button type="button">elsewhere</button>
        <Controls
          layout={NEW_INSTALL}
          layoutLoaded
          onCommit={vi.fn()}
          onNext={vi.fn()}
          onToggleInfo={vi.fn()}
          onToggleSettings={vi.fn()}
        />
      </AddMenuControlProvider>
    </EditModeProvider>,
  )
}

const menu = () => screen.queryByRole('menu', { name: 'Add a widget' })

describe('the Add menu handle', () => {
  it('is null outside a provider, where the menu keeps its own state', () => {
    render(<Spy />)

    expect(handle).toBeNull()
  })

  it('opens the menu while editing, as the Add button does', () => {
    renderPage()
    act(() => edit?.enter())

    act(() => handle?.setOpen(true))

    expect(menu()).not.toBeNull()
    // As when it is opened with the button: the first item takes focus.
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Clock/ }))
  })

  it('opens it quietly, leaving focus where it was', () => {
    renderPage()
    act(() => edit?.enter())
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    elsewhere.focus()

    act(() => handle?.setOpen(true, { quiet: true }))

    expect(menu()).not.toBeNull()
    expect(document.activeElement).toBe(elsewhere)
  })

  it('shuts it, and a menu the person opens afterwards takes focus as usual', () => {
    renderPage()
    act(() => edit?.enter())
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    elsewhere.focus()
    act(() => handle?.setOpen(true, { quiet: true }))

    act(() => handle?.setOpen(false))
    expect(menu()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Clock/ }))
  })

  it('reports whether the menu is open, from the button as from the handle', () => {
    renderPage()
    act(() => edit?.enter())
    expect(handle?.open).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(handle?.open).toBe(true)
  })

  it('shuts with edit mode', () => {
    renderPage()
    act(() => edit?.enter())
    act(() => handle?.setOpen(true, { quiet: true }))

    act(() => edit?.leave())

    expect(menu()).toBeNull()
    expect(handle?.open).toBe(false)
  })

  it('stays open when a note is pressed, as the tour’s Next is, and shuts for a press anywhere else', () => {
    renderPage()
    act(() => edit?.enter())
    const note = document.createElement('div')
    note.className = 'callout'
    const next = document.createElement('button')
    note.append(next)
    document.body.append(note)
    act(() => handle?.setOpen(true, { quiet: true }))

    // The note is beside the menu, and goes if the menu does: a press that took the menu away
    // would take the note from under the pointer before the click arrived.
    fireEvent.pointerDown(next)
    expect(menu()).not.toBeNull()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(menu()).toBeNull()
    note.remove()
  })
})
