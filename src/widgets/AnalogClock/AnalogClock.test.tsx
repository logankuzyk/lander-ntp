import { act, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalogClock } from './AnalogClock'

const AT = (hour: number, minute: number, second = 0, millisecond = 0) =>
  new Date(2026, 8, 11, hour, minute, second, millisecond)
const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AT(21, 5, 9))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor)
})

describe('Analog clock', () => {
  it('draws the chosen dial and exposes an image label with minute precision', () => {
    const { container } = render(<AnalogClock face="numerals" showDate showSeconds />)
    const dial = container.querySelector('svg')
    expect(dial?.getAttribute('role')).toBe('img')
    expect(dial?.getAttribute('aria-label')).toBe('Analog clock, 21:05')
    expect(container.querySelectorAll('.analog-clock__numeral')).toHaveLength(12)
    expect(container.querySelector('.analog-clock__date')?.textContent).toBe('11')
    expect(container.querySelector('.analog-clock__hand--second')).not.toBeNull()
  })

  it('does not add numerals or a seconds hand when those options are off', () => {
    const { container } = render(
      <AnalogClock face="minimal" showDate={false} showSeconds={false} />,
    )
    expect(container.querySelectorAll('.analog-clock__numeral')).toHaveLength(0)
    expect(container.querySelector('.analog-clock__hand--second')).toBeNull()
    expect(container.querySelector('.analog-clock__date')).toBeNull()
  })

  it('lands on a second boundary and schedules the following tick from that boundary', async () => {
    vi.setSystemTime(AT(21, 5, 9, 990))
    const { container } = render(<AnalogClock face="ticks" showDate={false} showSeconds />)
    await act(async () => {
      vi.advanceTimersByTime(10)
    })
    expect(container.querySelector('.analog-clock__hand--second')?.getAttribute('transform')).toBe(
      'rotate(60 50 50)',
    )
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(container.querySelector('.analog-clock__hand--second')?.getAttribute('transform')).toBe(
      'rotate(66 50 50)',
    )
  })

  it('ticks on the next minute boundary without a seconds hand', async () => {
    const { container } = render(<AnalogClock face="ticks" showDate={false} showSeconds={false} />)
    const before = container.querySelector('.analog-clock__hand--minute')?.getAttribute('transform')
    await act(async () => {
      vi.advanceTimersByTime(50_999)
    })
    expect(container.querySelector('.analog-clock__hand--minute')?.getAttribute('transform')).toBe(
      before,
    )
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(container.querySelector('.analog-clock__hand--minute')?.getAttribute('transform')).toBe(
      'rotate(36 50 50)',
    )
  })

  it('updates its accessible time label only when the minute changes', async () => {
    const { container } = render(<AnalogClock face="ticks" showDate={false} showSeconds />)
    const dial = container.querySelector('svg')!
    expect(dial.getAttribute('aria-label')).toBe('Analog clock, 21:05')
    await act(async () => {
      vi.advanceTimersByTime(50_000)
    })
    expect(dial.getAttribute('aria-label')).toBe('Analog clock, 21:05')
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })
    expect(dial.getAttribute('aria-label')).toBe('Analog clock, 21:06')
  })

  it('stops while hidden and redraws immediately when shown', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    const { container } = render(<AnalogClock face="ticks" showDate={false} showSeconds />)
    visibility = 'hidden'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      vi.setSystemTime(AT(21, 5, 20))
      vi.advanceTimersByTime(5_000)
    })
    expect(container.querySelector('.analog-clock__hand--second')?.getAttribute('transform')).toBe(
      'rotate(54 50 50)',
    )
    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(container.querySelector('.analog-clock__hand--second')?.getAttribute('transform')).toBe(
      'rotate(150 50 50)',
    )
  })
})
