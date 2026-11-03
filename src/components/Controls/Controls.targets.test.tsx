import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider } from '@/components/EditMode/useEditMode'

import { Controls } from './Controls'

const renderControls = () =>
  render(
    <EditModeProvider>
      <Controls onNext={vi.fn()} onToggleInfo={vi.fn()} onToggleSettings={vi.fn()} />
    </EditModeProvider>,
  )

describe('Controls, for a callout', () => {
  it('names the Edit button as a thing to point at, in or out of edit mode', () => {
    renderControls()
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit.getAttribute('data-callout-target')).toBe('edit')

    fireEvent.click(edit)

    // The same button, now Done: a callout beside it stays beside it.
    expect(screen.getByRole('button', { name: 'Done' })).toBe(edit)
    expect(edit.getAttribute('data-callout-target')).toBe('edit')
  })

  it('names none of the page’s other buttons', () => {
    renderControls()

    const named = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-callout-target'))
    expect(named.map((button) => button.getAttribute('aria-label'))).toEqual(['Edit'])
  })
})
