import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Switch } from './Switch'

describe('Switch', () => {
  it('is a row with the label and a checkbox that says it is a switch', () => {
    const { container } = render(<Switch checked label="Show date" onChange={vi.fn()} />)

    const row = container.querySelector('label')
    expect(row?.className).toBe('settings__row')
    expect(row?.querySelector('span')?.textContent).toBe('Show date')
    const control = screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement
    expect(control.type).toBe('checkbox')
    expect(control.className).toBe('switch')
  })

  it('shows whether it is on', () => {
    const { rerender } = render(<Switch checked label="Dim the photo" onChange={vi.fn()} />)
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(true)

    rerender(<Switch checked={false} label="Dim the photo" onChange={vi.fn()} />)
    expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false)
  })

  it('says what it was changed to, once per change', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} label="Show seconds" onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Show seconds' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is changed by its label too', () => {
    const onChange = vi.fn()
    render(<Switch checked label="Show seconds" onChange={onChange} />)

    fireEvent.click(screen.getByText('Show seconds'))

    expect(onChange).toHaveBeenCalledWith(false)
  })
})
