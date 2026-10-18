import { render } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'

import type { WidgetDefinition } from './definition'
import { WidgetHost } from './WidgetHost'

const time = (container: ParentNode) => container.querySelector('.clock__time')?.textContent

describe('WidgetHost', () => {
  it("draws the Widget's View with its options and the page's values", () => {
    const { container } = render(
      <WidgetHost
        definition={clockDefinition}
        options={{ showDate: true, showSeconds: true }}
        page={{ hour12: true }}
      />,
    )
    expect(time(container)).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
    expect(container.querySelector('.clock__date')).not.toBeNull()
  })

  it('follows the page value for 12/24-hour time', () => {
    // Local time, so the assertions don't depend on the machine's timezone.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 21, 5, 9))
    try {
      const twelve = render(
        <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: true }} />,
      )
      expect(time(twelve.container)).toBe('9:05')
      const twentyFour = render(
        <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: false }} />,
      )
      expect(time(twentyFour.container)).toBe('21:05')
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds no element of its own: the first thing in the container is the Widget', () => {
    const { container } = render(
      <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: false }} />,
    )
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild?.classList.contains('clock')).toBe(true)
  })

  it('reads the options through the definition: a missing one is its default, a bad one costs the Widget its options', () => {
    const seen: unknown[] = []
    const example: WidgetDefinition<{ flag: boolean; other: boolean }> = {
      name: 'Example',
      options: [
        { control: 'switch', default: true, id: 'flag', label: 'Flag' },
        { control: 'switch', default: false, id: 'other', label: 'Other' },
      ],
      type: 'example',
      View: ({ options }) => {
        seen.push(options)
        return null
      },
    }

    render(<WidgetHost definition={example} options={{ other: true }} page={{ hour12: false }} />)
    render(
      <WidgetHost
        definition={example}
        options={{ flag: false, other: 'nope' }}
        page={{ hour12: false }}
      />,
    )

    expect(seen).toEqual([
      { flag: true, other: true },
      { flag: true, other: false },
    ])
  })
})
