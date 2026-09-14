import { act, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Clock } from './Clock'

// Local time, so the assertions don't depend on the machine's timezone.
const AT = (h: number, m: number, s = 0) => new Date(2026, 8, 11, h, m, s)

const time = (container: ParentNode) => container.querySelector('.clock__time')?.textContent

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AT(21, 5, 9))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Clock', () => {
  it('shows 24-hour time by default', () => {
    const { container } = render(<Clock hour12={false} showDate={false} showSeconds={false} />)
    expect(time(container)).toBe('21:05')
  })

  it('shows 12-hour time without the am/pm suffix', () => {
    const { container } = render(<Clock hour12 showDate={false} showSeconds={false} />)
    expect(time(container)).toBe('9:05')
  })

  it('can show seconds', () => {
    const { container } = render(<Clock hour12={false} showDate={false} showSeconds />)
    expect(time(container)).toBe('21:05:09')
  })

  it('can show the date', () => {
    const { container } = render(
      <Clock hour12={false} showDate showSeconds={false} locale="en-GB" />,
    )
    expect(container.querySelector('.clock__date')?.textContent).toBe('Friday 11 September')
  })

  it('ticks on the minute boundary, not a minute after mounting', async () => {
    vi.setSystemTime(AT(21, 5, 30))
    const { container } = render(<Clock hour12={false} showDate={false} showSeconds={false} />)

    await act(async () => {
      vi.advanceTimersByTime(29_000)
    })
    expect(time(container)).toBe('21:05')

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(time(container)).toBe('21:06')
  })

  it('ticks every second when showing seconds', async () => {
    const { container } = render(<Clock hour12={false} showDate={false} showSeconds />)

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(time(container)).toBe('21:05:10')
  })
})
