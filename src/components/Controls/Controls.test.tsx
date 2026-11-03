import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider } from '@/components/EditMode/useEditMode'

import { Controls } from './Controls'

const renderControls = ({ busy = false, withInfo = true } = {}) => {
  const onNext = vi.fn()
  const onToggleSettings = vi.fn()
  const onToggleInfo = vi.fn()
  render(
    <EditModeProvider>
      <Controls
        busy={busy}
        infoOpen={false}
        onNext={onNext}
        onToggleInfo={withInfo ? onToggleInfo : undefined}
        onToggleSettings={onToggleSettings}
        settingsOpen={false}
      />
    </EditModeProvider>,
  )
  return { onNext, onToggleInfo, onToggleSettings }
}

describe('Controls', () => {
  it('shows the next photo from the button', () => {
    const { onNext } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    expect(onNext).toHaveBeenCalledOnce()
  })

  it('shows the next photo with the → key', () => {
    const { onNext } = renderControls()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onNext).toHaveBeenCalledOnce()
  })

  it('toggles the settings', () => {
    const { onToggleSettings } = renderControls()
    const button = screen.getByRole('button', { name: 'Settings' })

    fireEvent.click(button)

    expect(onToggleSettings).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles the photo details from the button and the i key', () => {
    const { onToggleInfo } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Photo details' }))
    fireEvent.keyDown(window, { key: 'i' })

    expect(onToggleInfo).toHaveBeenCalledTimes(2)
  })

  it('hides the photo details button when the widget is switched off', () => {
    const { onNext } = renderControls({ withInfo: false })

    expect(screen.queryByRole('button', { name: 'Photo details' })).toBeNull()
    fireEvent.keyDown(window, { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('has no gallery button: the gallery is in settings', () => {
    renderControls()

    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull()
  })

  it('ignores shortcuts with modifiers, other keys and typing in a field', () => {
    const { onNext, onToggleInfo } = renderControls()
    render(<input aria-label="Search" />)

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(window, { altKey: true, key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { ctrlKey: true, key: 'i' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
    expect(onToggleInfo).not.toHaveBeenCalled()
  })

  it('ignores shortcuts pressed inside a popover', () => {
    const { onNext, onToggleInfo } = renderControls()
    render(
      <aside aria-label="Settings" class="popover" role="dialog">
        <button type="button">Beach</button>
      </aside>,
    )
    const button = screen.getByRole('button', { name: 'Beach' })

    fireEvent.keyDown(button, { key: 'ArrowRight' })
    fireEvent.keyDown(button, { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
    expect(onToggleInfo).not.toHaveBeenCalled()
  })

  it('ignores shortcuts pressed inside the welcome', () => {
    const { onNext, onToggleInfo } = renderControls()
    render(
      <dialog open>
        <button type="button">Skip</button>
      </dialog>,
    )
    const button = screen.getByRole('button', { name: 'Skip' })

    fireEvent.keyDown(button, { key: 'ArrowRight' })
    fireEvent.keyDown(button, { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
    expect(onToggleInfo).not.toHaveBeenCalled()
  })

  it('marks the next-photo button busy while the photo is loading', () => {
    // The cross-fade holds the old photo until the new one is ready, so without this the
    // press looks like it did nothing.
    renderControls({ busy: true })
    const button = screen.getByRole('button', { name: 'Next photo' })

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.classList.contains('control--busy')).toBe(true)
  })

  it('ignores the button and the arrow key while the photo is loading', () => {
    // Each press stacks another full-resolution image over the one already being waited on.
    const { onNext } = renderControls({ busy: true })

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('leaves the button alone when nothing is loading', () => {
    renderControls()
    const button = screen.getByRole('button', { name: 'Next photo' })

    expect(button.getAttribute('aria-busy')).toBe('false')
    expect(button.classList.contains('control--busy')).toBe(false)
  })

  describe('edit mode', () => {
    const editButton = () => screen.getByRole('button', { name: 'Edit' })
    const doneButton = () => screen.getByRole('button', { name: 'Done' })

    it('has an Edit button that is not pressed', () => {
      renderControls()

      expect(editButton().getAttribute('aria-pressed')).toBe('false')
      expect(editButton().getAttribute('title')).toBe('Edit (E)')
    })

    it('sits first, so the page’s own buttons stay where they are when it reads Done', () => {
      renderControls()

      const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
      expect(names).toEqual(['Edit', 'Next photo', 'Photo details', 'Settings'])
    })

    it('reads Done and is pressed while editing, and Edit again once it is pressed', () => {
      renderControls()

      fireEvent.click(editButton())
      expect(doneButton().getAttribute('aria-pressed')).toBe('true')
      expect(doneButton().getAttribute('title')).toBe('Done (E)')
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()

      fireEvent.click(doneButton())
      expect(editButton().getAttribute('aria-pressed')).toBe('false')
    })

    it('keeps focus on the button when it changes from Edit to Done', () => {
      renderControls()
      editButton().focus()

      fireEvent.click(editButton())

      expect(document.activeElement).toBe(doneButton())
    })

    it('is toggled by the E key', () => {
      renderControls()

      fireEvent.keyDown(window, { key: 'e' })
      expect(doneButton()).toBeTruthy()

      fireEvent.keyDown(window, { key: 'e' })
      expect(editButton()).toBeTruthy()
    })

    it('is left with Escape, and Escape does nothing otherwise', () => {
      renderControls()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(editButton()).toBeTruthy()

      fireEvent.keyDown(window, { key: 'e' })
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(editButton()).toBeTruthy()
    })

    it('ignores E and Escape with modifiers, in a field, in a popover and in the welcome', () => {
      renderControls()
      render(<input aria-label="Search" />)
      render(
        <aside aria-label="Settings" class="popover" role="dialog">
          <button type="button">Beach</button>
        </aside>,
      )
      render(
        <dialog open>
          <button type="button">Skip</button>
        </dialog>,
      )

      fireEvent.keyDown(window, { key: 'e', metaKey: true })
      fireEvent.keyDown(window, { ctrlKey: true, key: 'e' })
      fireEvent.keyDown(window, { altKey: true, key: 'e' })
      fireEvent.keyDown(window, { key: 'E', shiftKey: true })
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'e' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Beach' }), { key: 'e' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Skip' }), { key: 'e' })
      expect(editButton()).toBeTruthy()

      fireEvent.keyDown(window, { key: 'e' })
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Beach' }), { key: 'Escape' })
      fireEvent.keyDown(screen.getByRole('button', { name: 'Skip' }), { key: 'Escape' })
      expect(doneButton()).toBeTruthy()
    })

    it('leaves Escape to whatever already used it, such as a popover that closes first', () => {
      renderControls()
      fireEvent.keyDown(window, { key: 'e' })
      // The popover's own listener is on the document, ahead of the window's.
      document.addEventListener('keydown', (event) => event.preventDefault(), { once: true })

      fireEvent.keyDown(document.body, { key: 'Escape' })

      expect(doneButton()).toBeTruthy()
    })

    it('keeps the other buttons and the → key working while editing', () => {
      const { onNext, onToggleInfo, onToggleSettings } = renderControls()
      fireEvent.keyDown(window, { key: 'e' })

      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
      fireEvent.click(screen.getByRole('button', { name: 'Photo details' }))
      fireEvent.keyDown(window, { key: 'i' })
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

      expect(onNext).toHaveBeenCalledTimes(2)
      expect(onToggleInfo).toHaveBeenCalledTimes(2)
      expect(onToggleSettings).toHaveBeenCalledOnce()
      expect(doneButton()).toBeTruthy()
    })
  })
})
