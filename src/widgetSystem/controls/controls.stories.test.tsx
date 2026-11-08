import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import choice, * as choiceStories from './Choice.stories'
import list, * as listStories from './OrderedListControl.stories'
import place, * as placeStories from './PlaceControl.stories'
import toggle, * as switchStories from './Switch.stories'

type Module = { default: { args?: object; render?: unknown } }

/** Draws a story as Storybook does, minus the decorators: its args through the meta's render. */
const draw = <S extends { args?: object }>(meta: Module['default'], story: S) => {
  const args = { ...meta.args, ...story.args }
  return render(<>{(meta.render as (args: unknown) => never)(args)}</>)
}

describe('control stories', () => {
  it('Switch responds, in both states', () => {
    draw(toggle, switchStories.On)
    const control = () => screen.getByRole('switch', { name: 'Show date' }) as HTMLInputElement
    expect(control().checked).toBe(true)
    fireEvent.click(control())
    expect(control().checked).toBe(false)
    screen.getByRole('switch').remove()

    draw(toggle, switchStories.Off)
    expect((screen.getAllByRole('switch').at(-1) as HTMLInputElement).checked).toBe(false)
  })

  it('Choice responds', () => {
    draw(choice, choiceStories.Fahrenheit)
    expect(screen.getByRole('combobox', { name: 'Units' }).textContent).toContain('Fahrenheit')

    fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
    fireEvent.click(screen.getByRole('option', { name: 'Celsius' }))

    expect(screen.getByRole('combobox', { name: 'Units' }).textContent).toContain('Celsius')
  })

  it('Choice lists them all in ManyChoices', () => {
    draw(choice, choiceStories.ManyChoices)

    fireEvent.click(screen.getByRole('combobox', { name: 'Change photo' }))

    expect(screen.getAllByRole('option')).toHaveLength(10)
  })

  it.each([
    ['SomeShown', ['Show Location', 'Show High and low'], ['Show Sunrise and sunset']],
    ['AllShown', ['Show Sunrise and sunset', 'Show Conditions'], []],
    ['NoneShown', [], ['Show Sunrise and sunset', 'Show Conditions']],
  ] as const)('OrderedList shows %s', (name, shown, hidden) => {
    draw(list, listStories[name])

    const pressed = (label: string) =>
      screen.getByRole('button', { name: label }).getAttribute('aria-pressed')
    for (const label of shown) expect(pressed(label)).toBe('true')
    for (const label of hidden) expect(pressed(label)).toBe('false')
  })

  it('OrderedList responds, and is named by its heading', () => {
    draw(list, listStories.SomeShown)
    const rows = () =>
      within(screen.getByRole('list', { name: 'Show' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent)
    expect(rows()[0]).toBe('High and low')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder High and low' }), {
      key: 'ArrowDown',
    })

    expect(rows().slice(0, 2)).toEqual(['Location', 'High and low'])
  })

  it('PlaceControl is the search with no place, the place when set and the device when following', () => {
    draw(place, placeStories.Empty)
    expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
    screen.getByRole('combobox').remove()

    draw(place, placeStories.Set)
    expect(screen.getByText(/^Victoria/)).toBeTruthy()
    screen
      .getByText(/^Victoria/)
      .closest('.settings__row')
      ?.remove()

    draw(place, placeStories.Following)
    expect(screen.getByText(/^Current location/)).toBeTruthy()
  })

  it('PlaceControl lists the places the stubbed search finds in WithResults, sending nothing', async () => {
    const real = globalThis.fetch
    let sent = 0
    globalThis.fetch = (() => {
      sent++
      return Promise.reject(new Error('the network'))
    }) as typeof fetch
    try {
      const beforeEach = placeStories.WithResults.beforeEach as (context: never) => unknown
      const cleanup = await beforeEach({} as never)
      draw(place, placeStories.WithResults)

      fireEvent.input(screen.getByRole('combobox', { name: 'Search for a place' }), {
        target: { value: 'Victoria' },
      })

      await waitFor(() =>
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
          'Victoria, British Columbia, Canada',
          'Victoria, Texas, United States',
          'Victoria, Mahé, Seychelles',
        ]),
      )
      expect(sent).toBe(0)
      if (typeof cleanup === 'function') cleanup()
    } finally {
      globalThis.fetch = real
    }
  })
})
