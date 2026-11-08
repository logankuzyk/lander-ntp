import { act, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SIZES } from '@/test/fixtures'
import { clockDefinition } from '@/widgets/Clock/definition'

import type { WidgetDefinition } from './definition'
import type { Need } from './needs'
import { WidgetBox } from './WidgetBox'

const RECT = { col: 5, h: 2, row: 4, w: 4 }
const page = { hour12: false }

const time = (container: ParentNode) => container.querySelector('.clock__time')?.textContent

/** The box a Widget sits in. */
const box = (container: ParentNode) => {
  const found = container.querySelector('.widget-box')
  if (!found) throw new Error('no box was drawn')
  return found
}

type Options = { place: string }

/** A Widget made up here whose summary is the place it was given. */
const example = (needs?: readonly Need<Options>[]): WidgetDefinition<Options> => ({
  name: 'Example',
  needs,
  options: [
    {
      choices: [
        { label: 'Here', value: 'here' },
        { label: 'There', value: 'there' },
      ],
      control: 'choice',
      default: 'here',
      id: 'place',
      label: 'Place',
    },
  ],
  sizes: EXAMPLE_SIZES,
  summary: (options) => options.place,
  type: 'example',
  View: ({ options }) => <p class="example">{options.place}</p>,
})

describe('WidgetBox, its accessible name', () => {
  it("is a group named for the Widget's name alone when it has no summary", () => {
    const { container } = render(
      <WidgetBox definition={clockDefinition} options={{}} page={page} rect={RECT} />,
    )
    expect(box(container).getAttribute('role')).toBe('group')
    expect(box(container).getAttribute('aria-label')).toBe('Clock')
  })

  it("adds the definition's summary of the options as the Widget reads them", () => {
    const { container } = render(
      <WidgetBox definition={example()} options={{ place: 'there' }} page={page} rect={RECT} />,
    )
    expect(box(container).getAttribute('aria-label')).toBe('Example, there')
    // A bad option is read as its default, and the name follows.
    const bad = render(
      <WidgetBox definition={example()} options={{ place: 'nowhere' }} page={page} rect={RECT} />,
    )
    expect(box(bad.container).getAttribute('aria-label')).toBe('Example, here')
  })

  it('can be found by its role and name', () => {
    const { container } = render(
      <WidgetBox definition={example()} options={{}} page={page} rect={RECT} />,
    )
    expect(screen.getByRole('group', { name: 'Example, here' })).toBe(box(container))
  })

  it('names two of a kind differently', () => {
    render(
      <>
        <WidgetBox definition={example()} options={{ place: 'here' }} page={page} rect={RECT} />
        <WidgetBox definition={example()} options={{ place: 'there' }} page={page} rect={RECT} />
      </>,
    )
    expect(screen.getAllByRole('group').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Example, here',
      'Example, there',
    ])
  })

  it('names the box while its needs are unmet, because the box is the place', () => {
    const { container } = render(
      <WidgetBox
        definition={example([{ id: 'a', met: () => false }])}
        options={{}}
        page={page}
        rect={RECT}
      />,
    )
    expect(box(container).children).toHaveLength(0)
    expect(box(container).getAttribute('aria-label')).toBe('Example, here')
  })

  it('follows the options when they change', () => {
    const definition = example()
    const view = render(
      <WidgetBox definition={definition} options={{ place: 'here' }} page={page} rect={RECT} />,
    )
    view.rerender(
      <WidgetBox definition={definition} options={{ place: 'there' }} page={page} rect={RECT} />,
    )
    expect(box(view.container).getAttribute('aria-label')).toBe('Example, there')
  })

  it('does not change as the Clock ticks, and nothing in the box is live, so a reader hears nothing each second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 21, 5, 58))
    try {
      const { container } = render(
        <WidgetBox
          definition={clockDefinition}
          options={{ showSeconds: true }}
          page={page}
          rect={RECT}
        />,
      )
      expect(time(container)).toBe('21:05:58')

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(time(container)).toBe('21:06:01')
      expect(box(container).getAttribute('aria-label')).toBe('Clock')
      expect(
        container.querySelector('[aria-live], [role="timer"], [role="status"], [role="log"]'),
      ).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
