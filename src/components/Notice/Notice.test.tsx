import { act, fireEvent, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('Notice with an action', () => {
  it('has the action beside the line, and Dismiss', () => {
    const onClick = vi.fn()
    render(
      <Notice action={{ label: 'Undo', onClick }} message="Clock removed." onDismiss={() => {}} />,
    )

    expect(
      screen
        .getAllByRole('button')
        .map((button) => button.textContent || button.getAttribute('aria-label')),
    ).toEqual(['Undo', 'Dismiss'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('says the line, and not the buttons, in its live region as the first thing', () => {
    render(
      <Notice
        action={{ label: 'Undo', onClick: () => {} }}
        message="Clock removed."
        onDismiss={() => {}}
      />,
    )

    expect(screen.getByRole('status').textContent?.startsWith('Clock removed.')).toBe(true)
  })

  it('keeps the message and both buttons in the same header row', () => {
    render(
      <Notice
        action={{ label: 'Undo', onClick: () => {} }}
        message="A long widget name removed."
        onDismiss={() => {}}
      />,
    )

    const header = document.querySelector('.callout--has-action .callout__header')
    expect(header?.querySelector('span')?.textContent).toBe('A long widget name removed.')
    expect(header?.querySelectorAll('button')).toHaveLength(2)
    expect(header?.children).toHaveLength(3)
  })
})

describe('Notice, keeping its words together', () => {
  it('marks the line that has a button beside it, so its words stay on one line', () => {
    const { rerender } = render(<Notice message="Clock removed." onDismiss={() => {}} />)
    expect(document.querySelector('.callout--has-action')).toBeNull()

    rerender(
      <Notice
        action={{ label: 'Undo', onClick: () => {} }}
        message="Clock removed."
        onDismiss={() => {}}
      />,
    )

    expect(document.querySelector('.callout--has-action')).not.toBeNull()
  })
})

describe('Notice that goes by itself', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const shown = (onDismiss: () => void, extra: { identity?: string } = {}) => (
    <Notice
      action={{ label: 'Undo', onClick: () => {} }}
      autoDismissMs={8000}
      message="Clock removed."
      onDismiss={onDismiss}
      {...extra}
    />
  )

  it('is dismissed after the time given, and not before', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(shown(onDismiss))

    act(() => {
      vi.advanceTimersByTime(7999)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while the pointer is over it, and goes after what was left when the pointer leaves', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(shown(onDismiss))
    const line = screen.getByRole('button', { name: 'Undo' }).closest('.callout') as HTMLElement

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    fireEvent.mouseEnter(line)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseLeave(line)
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while a button in it has focus, and goes after what was left when focus leaves', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(shown(onDismiss))
    const undo = screen.getByRole('button', { name: 'Undo' })

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    act(() => undo.focus())
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => undo.blur())
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('starts the time again for a new notice with the same words', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(shown(onDismiss, { identity: 'first' }))
    act(() => {
      vi.advanceTimersByTime(7000)
    })

    rerender(shown(onDismiss, { identity: 'second' }))
    act(() => {
      vi.advanceTimersByTime(7000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('stays for as long as the page keeps it when it has no time', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Notice message="Stays." onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(600_000)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
