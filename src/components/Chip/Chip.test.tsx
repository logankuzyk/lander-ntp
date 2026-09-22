import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Chip } from './Chip'

describe('Chip', () => {
  it('is a plain label by default', () => {
    render(<Chip label="Water" />)

    expect(screen.getByText('Water').tagName).toBe('SPAN')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is a toggle with onClick', () => {
    const onClick = vi.fn()
    render(<Chip label="Water" pressed onClick={onClick} />)
    const chip = screen.getByRole('button', { name: 'Water' })

    fireEvent.click(chip)

    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has a × with onRemove', () => {
    const onRemove = vi.fn()
    render(<Chip label="Water" size="s" onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Water' }))

    expect(onRemove).toHaveBeenCalledOnce()
    expect(screen.getByText('Water').classList.contains('chip--s')).toBe(true)
  })
})
