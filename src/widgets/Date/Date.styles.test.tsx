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
})
