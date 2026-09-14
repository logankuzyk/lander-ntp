import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Controls } from './Controls'

const renderControls = ({ withInfo = true } = {}) => {
  const onNext = vi.fn()
  const onOpenSettings = vi.fn()
  const onToggleInfo = vi.fn()
  render(
    <Controls
      onNext={onNext}
      onOpenSettings={onOpenSettings}
      onToggleInfo={withInfo ? onToggleInfo : undefined}
      infoOpen={false}
    />,
  )
  return { onNext, onOpenSettings, onToggleInfo }
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
})
