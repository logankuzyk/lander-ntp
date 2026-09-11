import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Controls } from './Controls'

describe('Controls', () => {
  it('shows the next photo from the button', () => {
    const onNext = vi.fn()
    render(<Controls onNext={onNext} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    expect(onNext).toHaveBeenCalledOnce()
  })

  it('shows the next photo with the → key', () => {
    const onNext = vi.fn()
    render(<Controls onNext={onNext} />)

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onNext).toHaveBeenCalledOnce()
  })

  it('ignores → with modifiers, other keys and typing in a field', () => {
    const onNext = vi.fn()
    render(
      <>
        <Controls onNext={onNext} />
        <input aria-label="Search" />
      </>,
    )

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'ArrowRight' })

    expect(onNext).not.toHaveBeenCalled()
  })
})
