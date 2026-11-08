import { describe, expect, it } from 'vitest'

import { rule } from '@/test/styles'

describe('Date styles', () => {
  it('sizes its text from the Widget box with container units and clamp', () => {
    for (const selector of ['.date--line', '.date--card', '.date--grid', '.date--week']) {
      expect(rule(selector)).toMatch(/font-size:[^;]*clamp\(/)
      expect(rule(selector)).toMatch(/cqw/)
      expect(rule(selector)).not.toMatch(/[\d.]vw/)
    }
  })

  it('uses the page font for text and a serif numeral in the day card', () => {
    expect(rule('.date')).toContain('text-shadow: var(--text-shadow)')
    expect(rule('.date__card-day')).toMatch(
      /font-family: var\(--font-serif, 'Instrument Serif', serif\)/,
    )
  })

  it('thins the Analog Clock date window border', () => {
    expect(rule('.analog-clock__date-window')).toMatch(/stroke-width:\s*1(?:;|$)/)
  })

  it('centres the Analog Clock date text vertically in its window', () => {
    expect(rule('.analog-clock__date')).toMatch(/dominant-baseline:\s*middle(?:;|$)/)
  })

  it('aligns the month heading with the calendar grid', () => {
    expect(rule('.date__month')).toMatch(/text-align:\s*left(?:;|$)/)
  })

  it('clips full weekday names to their month-grid columns', () => {
    const weekday = rule('.date--grid.date--long .date__weekday')
    expect(weekday).toContain('overflow: hidden')
    expect(weekday).toContain('text-overflow: ellipsis')
    expect(weekday).toContain('white-space: nowrap')
  })
})
