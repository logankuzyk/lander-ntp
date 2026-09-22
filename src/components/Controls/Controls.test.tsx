import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Controls } from './Controls'

const renderControls = ({ withInfo = true, busy = false } = {}) => {
  const onNext = vi.fn()
  const onToggleSettings = vi.fn()
  const onToggleInfo = vi.fn()
  render(
    <Controls
      onNext={onNext}
      busy={busy}
      onToggleSettings={onToggleSettings}
      settingsOpen={false}
      onToggleInfo={withInfo ? onToggleInfo : undefined}
      infoOpen={false}
    />,
  )
  return { onNext, onToggleSettings, onToggleInfo }
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
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'i' })

    expect(onNext).not.toHaveBeenCalled()
    expect(onToggleInfo).not.toHaveBeenCalled()
  })

  it('ignores shortcuts pressed inside a popover', () => {
    const { onNext, onToggleInfo } = renderControls()
    render(
      <aside class="popover" role="dialog" aria-label="Settings">
        <button type="button">Beach</button>
      </aside>,
    )
    const button = screen.getByRole('button', { name: 'Beach' })

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
})
