import { fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'

import { Notice } from './Notice'

describe('Notice', () => {
  it('has its live region on the page before there is anything to say, so the line is read out when it arrives', () => {
    const { rerender } = render(<Notice message={null} onDismiss={() => {}} />)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')

    rerender(<Notice message="Couldn't save that. Try again in a minute." onDismiss={() => {}} />)

    // The same element, now with text in it: that is what a screen reader announces.
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toContain("Couldn't save that. Try again in a minute.")
  })

  it('is dismissed with its button, and has no other', () => {
    const onDismiss = vi.fn()
    render(<Notice message="Gone soon." onDismiss={onDismiss} />)

    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  describe('focus', () => {
    /** A page with something to press, and a notice it can show and take away. */
    function Page() {
      const [message, setMessage] = useState<string | null>(null)
      return (
        <>
          <button onClick={() => setMessage('Gone soon.')} type="button">
            Save
          </button>
          <button onClick={() => setMessage(null)} type="button">
            Time is up
          </button>
          <Notice message={message} onDismiss={() => setMessage(null)} />
        </>
      )
    }

    it('goes back to what had it before the notice came, when the notice is dismissed', () => {
      render(<Page />)
      const save = screen.getByRole('button', { name: 'Save' })
      save.focus()
      fireEvent.click(save)

      screen.getByRole('button', { name: 'Dismiss' }).focus()
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
      expect(document.activeElement).toBe(save)
    })

    it('goes back too when the page takes the notice away while its button has focus', () => {
      render(<Page />)
      const save = screen.getByRole('button', { name: 'Save' })
      save.focus()
      fireEvent.click(save)

      screen.getByRole('button', { name: 'Dismiss' }).focus()
      fireEvent.click(screen.getByRole('button', { name: 'Time is up' }))

      expect(document.activeElement).toBe(save)
    })

    it('is left alone when the notice did not have it', () => {
      render(<Page />)
      const save = screen.getByRole('button', { name: 'Save' })
      save.focus()
      fireEvent.click(save)
      const other = screen.getByRole('button', { name: 'Time is up' })
      other.focus()

      fireEvent.click(other)

      expect(document.activeElement).toBe(other)
    })
  })
})
