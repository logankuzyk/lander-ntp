import { fireEvent, render, screen, within } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'

import type { ListEntry } from '../definition'
import { OrderedListControl } from './OrderedListControl'

const ITEMS = [
  { id: 'north', label: 'North' },
  { id: 'south', label: 'South' },
  { id: 'east', label: 'East' },
  { id: 'west', label: 'West' },
]

/** Two shown and two hidden, to move between. */
const LIST: ListEntry[] = [
  { id: 'north', shown: true },
  { id: 'south', shown: true },
  { id: 'east', shown: false },
  { id: 'west', shown: false },
]

const draw = (value: readonly ListEntry[] = LIST) => {
  const onChange = vi.fn()
  render(
    <>
      <h3 id="points-heading">Points</h3>
      <OrderedListControl
        items={ITEMS}
        labelledBy="points-heading"
        onChange={onChange}
        value={value}
      />
    </>,
  )
  return onChange
}

/** Whether a row can be dragged: the property in a browser, the attribute where there is none. */
const draggable = (row: HTMLElement) => row.draggable ?? row.getAttribute('draggable') === 'true'

const rows = () =>
  within(screen.getByRole('list', { name: 'Points' }))
    .getAllByRole('listitem')
    .map((row) => row.textContent)
const ids = (list: readonly ListEntry[]) => list.map(({ id }) => id)
const lastValue = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall?.[0] as ListEntry[]
const row = (name: string) =>
  screen.getByRole('button', { name: `Reorder ${name}` }).closest('li') as HTMLElement

describe('OrderedListControl', () => {
  it('lists every item in order under the label it is named by, with an eye open for the shown', () => {
    draw()

    expect(rows()).toEqual(['North', 'South', 'East', 'West'])
    expect(screen.getByRole('list').className).toBe('fields')
    const pressed = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed')
    expect(pressed('Show North')).toBe('true')
    expect(pressed('Show West')).toBe('false')
    expect(row('West').className).toBe('fields__row fields__row--hidden')
    expect(row('North').className).toBe('fields__row')
  })

  it('moves an item switched on to the end of the shown ones', () => {
    const onChange = draw()

    fireEvent.click(screen.getByRole('button', { name: 'Show West' }))

    expect(lastValue(onChange)).toEqual([
      { id: 'north', shown: true },
      { id: 'south', shown: true },
      { id: 'west', shown: true },
      { id: 'east', shown: false },
    ])
  })

  it('moves an item switched off to just after the last shown one', () => {
    const onChange = draw()

    fireEvent.click(screen.getByRole('button', { name: 'Show North' }))

    expect(lastValue(onChange)).toEqual([
      { id: 'south', shown: true },
      { id: 'north', shown: false },
      { id: 'east', shown: false },
      { id: 'west', shown: false },
    ])
  })

  it('keeps what else an entry carries when it moves', () => {
    const onChange = draw([
      { id: 'north', shown: true },
      { id: 'south', note: 'kept', shown: false } as ListEntry,
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Show South' }))

    expect(lastValue(onChange)[1]).toEqual({ id: 'south', note: 'kept', shown: true })
  })

  it('reorders by dragging a row onto another, saying so only on the drop', () => {
    const onChange = draw()

    fireEvent.dragStart(row('West'))
    fireEvent.dragOver(row('North'))
    expect(rows()[0]).toBe('West')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.dragEnd(row('West'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(ids(lastValue(onChange))).toEqual(['west', 'north', 'south', 'east'])
  })

  it('says nothing when a row is dropped where it started', () => {
    const onChange = draw()

    fireEvent.dragStart(row('North'))
    fireEvent.dragEnd(row('North'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('puts the order back when the drag is cancelled', () => {
    const onChange = draw()

    fireEvent.dragStart(row('West'))
    fireEvent.dragOver(row('North'))
    fireEvent.dragEnd(row('West'), { dataTransfer: { dropEffect: 'none' } })

    expect(onChange).not.toHaveBeenCalled()
    expect(rows()).toEqual(['North', 'South', 'East', 'West'])
  })

  it('reorders with the arrow keys from the handle, announcing it and stopping at the ends', () => {
    const onChange = draw()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder North' }), { key: 'ArrowDown' })
    expect(ids(lastValue(onChange))).toEqual(['south', 'north', 'east', 'west'])
    expect(screen.getByText('North moved to be shown after south')).toBeTruthy()

    onChange.mockClear()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder North' }), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder West' }), { key: 'ArrowDown' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('announces an item moved to the top as first', () => {
    draw()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder South' }), { key: 'ArrowUp' })

    expect(screen.getByText('South moved to be shown first')).toBeTruthy()
  })

  it('keeps the focus on a handle whose row the arrow keys moved', () => {
    function Stateful() {
      const [value, setValue] = useState(LIST)
      return (
        <OrderedListControl
          items={ITEMS}
          labelledBy="points-heading"
          onChange={setValue}
          value={value}
        />
      )
    }
    render(<Stateful />)
    const handle = screen.getByRole('button', { name: 'Reorder North' })
    handle.focus()

    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    fireEvent.keyDown(handle, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(handle)
    expect(screen.getAllByRole('listitem')[2]?.contains(handle)).toBe(true)
  })

  it('keeps the arrow keys from scrolling the page, at the ends as well as between', () => {
    draw()

    const down = fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder North' }), {
      key: 'ArrowDown',
    })
    const upAtTop = fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder North' }), {
      key: 'ArrowUp',
    })
    const downAtEnd = fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder West' }), {
      key: 'ArrowDown',
    })
    const other = fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder North' }), {
      key: 'a',
    })

    // fireEvent says whether the event went unprevented.
    expect([down, upAtTop, downAtEnd]).toEqual([false, false, false])
    expect(other).toBe(true)
  })

  it('is turned off by disabled: nothing moves, shows or hides, and the rows cannot be dragged', () => {
    const onChange = vi.fn()
    render(
      <>
        <h3 id="points-heading">Points</h3>
        <OrderedListControl
          disabled
          items={ITEMS}
          labelledBy="points-heading"
          onChange={onChange}
          value={LIST}
        />
      </>,
    )

    for (const name of ['Reorder North', 'Show North', 'Show East']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement
      expect(button.disabled).toBe(true)
      fireEvent.click(button)
    }
    // A drag goes nowhere, so there is nothing to drop.
    for (const row of screen.getAllByRole('listitem')) {
      expect(draggable(row)).toBe(false)
    }
    const [north, south] = screen.getAllByRole('listitem')
    fireEvent.dragStart(north as HTMLElement)
    fireEvent.dragOver(south as HTMLElement)
    fireEvent.dragEnd(north as HTMLElement)

    expect(onChange).not.toHaveBeenCalled()
    expect(rows()).toEqual(['North', 'South', 'East', 'West'])
  })

  it('can be used unless it is told otherwise', () => {
    draw()

    for (const row of screen.getAllByRole('listitem')) expect(draggable(row)).toBe(true)
    expect((screen.getByRole('button', { name: 'Show North' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})
