import { act, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { Date } from './Date'

const cells = (w: number, h: number) => ({ h, w })
const options = {
  format: 'short' as const,
  monthGrid: true,
  showYear: false,
  weekNumbers: false,
  weekStartsOn: 'monday' as const,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new globalThis.Date(2025, 9, 18, 23, 59, 30))
})

afterEach(() => vi.useRealTimers())

describe('Date Widget', () => {
  it.each([
    [2, 1, 'date--line'],
    [4, 1, 'date--line'],
    [2, 2, 'date--card'],
    [3, 2, 'date--card'],
    [3, 3, 'date--grid'],
    [5, 1, 'date--week'],
    [5, 2, 'date--week'],
    [6, 6, 'date--grid'],
  ])('uses %s by %s cells for %s', (w, h, mode) => {
    const { container } = render(<Date cells={cells(w, h)} {...options} />)
    expect(container.querySelector(`.${mode}`)).not.toBeNull()
  })

  it('keeps the day card when the month grid is switched off', () => {
    const { container } = render(<Date cells={cells(3, 3)} {...options} monthGrid={false} />)
    expect(container.querySelector('.date--card')).not.toBeNull()
  })

  it('shows the chosen format and year in the smallest Widget', () => {
    const { container, rerender } = render(
      <Date cells={cells(2, 1)} {...options} format="short" showYear={false} />,
    )
    expect(container.textContent).toBe('Sat, Oct 18')
    rerender(<Date cells={cells(2, 1)} {...options} format="long" showYear />)
    expect(container.textContent).toBe('Saturday, October 18, 2025')
  })

  it('shows or hides the year in the month grid heading', () => {
    const { container, rerender } = render(
      <Date cells={cells(3, 3)} {...options} locale="en-US" showYear />,
    )
    expect(container.querySelector('.date__month')?.textContent).toBe('October 2025')

    rerender(<Date cells={cells(3, 3)} {...options} locale="en-US" showYear={false} />)
    expect(container.querySelector('.date__month')?.textContent).toBe('October')
  })

  it('shows or hides the year in the day card month label', () => {
    const { container, rerender } = render(
      <Date cells={cells(2, 2)} {...options} locale="en-US" showYear />,
    )
    expect(container.querySelector('.date__card-month')?.textContent).toBe('October 2025')

    rerender(<Date cells={cells(2, 2)} {...options} locale="en-US" showYear={false} />)
    expect(container.querySelector('.date__card-month')?.textContent).toBe('October')
  })

  it('marks only today in the week strip', () => {
    const { container } = render(<Date cells={cells(5, 1)} {...options} />)
    const currentDay = container.querySelector('time[aria-current="date"]')

    expect(container.querySelectorAll('time[aria-current="date"]')).toHaveLength(1)
    expect(currentDay?.getAttribute('datetime')).toBe(
      new globalThis.Date(2025, 9, 18, 12).toISOString(),
    )
  })

  it('shows the ISO week number and marks today in the month grid', () => {
    const { container } = render(<Date cells={cells(3, 3)} {...options} showYear weekNumbers />)
    expect(container.querySelectorAll('.date__week-number').length).toBe(5)
    expect(container.querySelector('[aria-current="date"]')?.textContent).toBe('18')
  })

  it.each(['monday', 'sunday'] as const)(
    'starts the January grid on %s and keeps ISO week 53 across the year boundary',
    (weekStartsOn) => {
      vi.setSystemTime(new globalThis.Date(2021, 0, 1, 12))
      const { container } = render(
        <Date cells={cells(3, 3)} {...options} weekNumbers weekStartsOn={weekStartsOn} />,
      )
      expect(container.querySelector('.date__week-number')?.textContent).toBe('53')
      const firstDay = container.querySelector('.date__weekday')?.textContent
      expect(firstDay).toBe(weekStartsOn === 'monday' ? 'M' : 'S')
    },
  )

  it('rolls over at local midnight and refreshes when a hidden tab becomes visible', async () => {
    const { container, rerender } = render(<Date cells={cells(2, 1)} {...options} />)
    expect(container.textContent).toBe('Sat, Oct 18')
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(container.textContent).toBe('Sun, Oct 19')

    vi.setSystemTime(new globalThis.Date(2025, 9, 20, 8, 0))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(container.textContent).toBe('Mon, Oct 20')
    rerender(<Date cells={cells(2, 1)} {...options} />)
  })

  it('does not read or write browser storage while showing a date', async () => {
    const get = vi.spyOn(fakeBrowser.storage.sync, 'get')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    render(<Date cells={cells(2, 2)} {...options} />)
    await act(async () => Promise.resolve())
    expect(get).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
})
