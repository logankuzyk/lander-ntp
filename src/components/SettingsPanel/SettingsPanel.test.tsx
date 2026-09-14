import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import type { Favourite } from '@/favourites/schema'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'

import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
}

const favourites: Favourite[] = [{ id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' }]

const renderPanel = (overrides: Partial<Settings> = {}) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  const onFavouritesChange = vi.fn()
  render(
    <SettingsPanel
      settings={{ ...settings, ...overrides }}
      onChange={onChange}
      favourites={favourites}
      onFavouritesChange={onFavouritesChange}
      onClose={onClose}
    />,
  )
  return { onChange, onClose, onFavouritesChange }
}

describe('SettingsPanel', () => {
  it('opens as a labelled dialog with focus inside it', () => {
    renderPanel()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('changes how often the photo changes', () => {
    const { onChange } = renderPanel()

    fireEvent.change(screen.getByLabelText('New photo'), { target: { value: 'daily' } })

    expect(onChange).toHaveBeenCalledWith({ ...settings, frequency: 'daily' })
  })

  it('switches to 24-hour time', () => {
    const { onChange } = renderPanel()
    const toggle = screen.getByLabelText('24-hour time') as HTMLInputElement

    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      clock: { ...settings.clock, hour12: false },
    })
  })

  it.each([
    ['Show clock', 'enabled', false],
    ['Show date', 'showDate', true],
    ['Show seconds', 'showSeconds', true],
  ])('toggles %s', (label, key, expected) => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByLabelText(label))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      clock: { ...settings.clock, [key]: expected },
    })
  })

  it('changes the font', () => {
    const { onChange } = renderPanel()

    fireEvent.change(screen.getByLabelText('Font'), { target: { value: 'fraunces' } })

    expect(onChange).toHaveBeenCalledWith({ ...settings, font: 'fraunces' })
  })

  it.each([
    ['Show favourites', 'enabled', false],
    ['Style', 'style', 'grid'],
    ['Size', 'size', 'l'],
  ])('changes the favourites %s setting', (label, key, value) => {
    const { onChange } = renderPanel()
    const control = screen.getByLabelText(label)

    if (typeof value === 'boolean') fireEvent.click(control)
    else fireEvent.change(control, { target: { value } })

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      favourites: { ...settings.favourites, [key]: value },
    })
  })

  it('edits the favourites list', () => {
    const { onFavouritesChange } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Portfolio' }))

    expect(onFavouritesChange).toHaveBeenCalledWith([])
  })

  it.each([
    ['Show photo credit', 'credit'],
    ['Show photo details', 'info'],
  ])('toggles %s', (label, key) => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByLabelText(label))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      widgets: { ...settings.widgets, [key]: false },
    })
  })

  it('closes with the button, the backdrop and Escape', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    fireEvent.click(document.querySelector('.settings__backdrop') as HTMLElement)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('keeps Tab inside the dialog', () => {
    renderPanel()
    const focusable = [
      ...screen.getByRole('dialog').querySelectorAll<HTMLElement>('button, select, input'),
    ]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    last?.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
