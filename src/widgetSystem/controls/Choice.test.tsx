import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { Choice } from './Choice'

const UNITS = [
  { label: 'Celsius', value: 'celsius' },
  { label: 'Fahrenheit', value: 'fahrenheit' },
] as const

describe('Choice', () => {
  it('is a row with the label, and a menu named by it that shows the current choice', () => {
    const { container } = render(
      <Choice choices={UNITS} label="Units" onChange={vi.fn()} value="fahrenheit" />,
    )

    expect(container.firstElementChild?.className).toBe('settings__row')
    const label = container.querySelector('span')
    expect(label?.textContent).toBe('Units')
    const menu = screen.getByRole('combobox', { name: 'Units' })
    expect(menu.getAttribute('aria-labelledby')).toContain(label?.id)
    expect(menu.textContent).toContain('Fahrenheit')
  })

  it('lists every choice, marking the current one', () => {
    render(<Choice choices={UNITS} label="Units" onChange={vi.fn()} value="celsius" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))

    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['Celsius', 'Fahrenheit'])
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false'])
  })

  it('says which value was picked, and nothing when the current one is picked again', () => {
    const onChange = vi.fn()
    render(<Choice choices={UNITS} label="Units" onChange={onChange} value="celsius" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
    fireEvent.click(screen.getByRole('option', { name: 'Celsius' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
    fireEvent.click(screen.getByRole('option', { name: 'Fahrenheit' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('fahrenheit')
  })
})
