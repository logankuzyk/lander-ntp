import { fireEvent, render, screen, within } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'

import { MultiSelect } from './MultiSelect'
import { Select } from './Select'

const FRUIT = [
  ['apple', 'Apple'],
  ['pear', 'Pear'],
  ['plum', 'Plum'],
] as const

type Fruit = (typeof FRUIT)[number][0]

const renderSelect = (value: Fruit = 'pear') => {
  const onChange = vi.fn()
  render(
    <>
      <span id="fruit">Fruit</span>
      <Select labelId="fruit" value={value} options={FRUIT} onChange={onChange} />
      <p>Elsewhere</p>
    </>,
  )
  return { onChange, field: screen.getByRole('combobox', { name: 'Fruit' }) }
}

const TAGS = [
  { value: 'water', label: 'Water' },
  { value: 'forest', label: 'Forest' },
  { value: 'urban', label: 'Urban' },
]

/** Keeps its own value, like the settings do. */
function Tags({ initial = [] as string[] }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <span id="tags">Tags</span>
      <MultiSelect labelId="tags" options={TAGS} value={value} onChange={setValue} allLabel="All" />
    </>
  )
}

describe('Select', () => {
  it('shows the value, and opens a menu of options with it marked', () => {
    const { field } = renderSelect()

    expect(field.textContent).toBe('Pear')
    expect(field.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(field)

    const menu = screen.getByRole('listbox', { name: 'Fruit' })
    expect(field.getAttribute('aria-expanded')).toBe('true')
    expect(within(menu).getByRole('option', { selected: true }).textContent).toBe('Pear')
    // Focus lands on the chosen option.
    expect(document.activeElement).toBe(within(menu).getByRole('option', { name: 'Pear' }))
  })

  it('picks an option, closes and puts focus back on the field', () => {
    const { onChange, field } = renderSelect()

    fireEvent.click(field)
    fireEvent.click(screen.getByRole('option', { name: 'Plum' }))

    expect(onChange).toHaveBeenCalledWith('plum')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(field)
  })

  it('moves between options with the arrow keys', () => {
    const { field } = renderSelect('apple')

    fireEvent.keyDown(field, { key: 'ArrowDown' })
    const menu = screen.getByRole('listbox')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Pear')
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement?.textContent).toBe('Plum')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Plum')
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(document.activeElement?.textContent).toBe('Apple')
  })

  it('closes with Escape without letting it reach the page', () => {
    const onPageEscape = vi.fn()
    document.addEventListener('keydown', onPageEscape)
    const { field } = renderSelect()

    fireEvent.click(field)
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    document.removeEventListener('keydown', onPageEscape)

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(field)
    expect(onPageEscape).not.toHaveBeenCalled()
  })

  it('closes with a click outside, and toggles from the field', () => {
    const { field } = renderSelect()

    fireEvent.click(field)
    fireEvent.pointerDown(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(field)
    fireEvent.pointerDown(field)
    fireEvent.click(field)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('MultiSelect', () => {
  it('shows all when nothing is chosen', () => {
    render(<Tags />)

    expect(screen.getByRole('combobox', { name: 'Tags' }).textContent).toBe('All')
  })

  it('adds tags, staying open with focus on the next option', () => {
    render(<Tags />)
    const field = screen.getByRole('combobox', { name: 'Tags' })

    fireEvent.click(field)
    const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
    menu.getByRole('option', { name: 'Water' }).focus()
    fireEvent.click(menu.getByRole('option', { name: 'Water' }))
    fireEvent.click(menu.getByRole('option', { name: 'Urban' }))

    expect(field.textContent).toBe('WaterUrban')
    expect(menu.getAllByRole('option').map((option) => option.textContent)).toEqual(['Forest'])
    expect(document.activeElement).toBe(menu.getByRole('option', { name: 'Forest' }))
    expect(
      within(menu.getByRole('group', { name: 'Chosen' }))
        .getAllByText(/./)
        .map((chip) => chip.textContent),
    ).toEqual(['Water', 'Urban'])
  })

  it('removes a chosen tag, or resets to all', () => {
    render(<Tags initial={['water', 'urban']} />)
    const field = screen.getByRole('combobox', { name: 'Tags' })

    fireEvent.click(field)
    const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
    fireEvent.click(menu.getByRole('button', { name: 'Remove Water' }))
    expect(field.textContent).toBe('Urban')

    fireEvent.click(menu.getByRole('button', { name: 'Reset to all' }))
    expect(field.textContent).toBe('All')
    expect((menu.getByRole('button', { name: 'Reset to all' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('leaves out a chosen tag the options no longer have', () => {
    render(<Tags initial={['gone', 'forest']} />)

    expect(screen.getByRole('combobox', { name: 'Tags' }).textContent).toBe('Forest')
  })
})
