import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Controls } from './Controls'

const renderControls = ({ withInfo = true, withGallery = true, busy = false } = {}) => {
  const onNext = vi.fn()
  const onOpenSettings = vi.fn()
  const onToggleInfo = vi.fn()
  const onToggleGallery = vi.fn()
  render(
    <Controls
      onNext={onNext}
      busy={busy}
      onOpenSettings={onOpenSettings}
      onToggleGallery={withGallery ? onToggleGallery : undefined}
      galleryOpen={false}
      onToggleInfo={withInfo ? onToggleInfo : undefined}
      infoOpen={false}
    />,
  )
  return { onNext, onOpenSettings, onToggleInfo, onToggleGallery }
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

  it('opens the settings panel', () => {
    const { onOpenSettings } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(onOpenSettings).toHaveBeenCalledOnce()
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

  it('toggles the gallery from the button and the g key', () => {
    const { onToggleGallery } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Choose a photo' }))
    fireEvent.keyDown(window, { key: 'g' })

    expect(onToggleGallery).toHaveBeenCalledTimes(2)
  })

  it('hides the gallery button when there is nothing to choose between', () => {
    const { onNext } = renderControls({ withGallery: false })

    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull()
    fireEvent.keyDown(window, { key: 'g' })

    expect(onNext).not.toHaveBeenCalled()
  })

  it('ignores shortcuts with modifiers, other keys and typing in a field', () => {
    const { onNext, onToggleInfo, onToggleGallery } = renderControls()
    render(<input aria-label="Search" />)

    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true })
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'i' })
    fireEvent.keyDown(window, { key: 'g', metaKey: true })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'g' })

    expect(onNext).not.toHaveBeenCalled()
    expect(onToggleInfo).not.toHaveBeenCalled()
    expect(onToggleGallery).not.toHaveBeenCalled()
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
