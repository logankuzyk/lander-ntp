import { describe, expect, it } from 'vitest'

import { faviconUrl, monogram } from './icon'

describe('faviconUrl', () => {
  it("uses Chromium's favicon cache", () => {
    const url = faviconUrl('https://logankuzyk.com/', 32, 'chrome')

    expect(url).toContain('/_favicon/?pageUrl=https%3A%2F%2Flogankuzyk.com%2F&size=32')
    expect(url?.startsWith('chrome-extension://')).toBe(true)
  })

  it('has nothing to use on Firefox, so the monogram is shown instead', () => {
    expect(faviconUrl('https://logankuzyk.com/', 32, 'firefox')).toBeNull()
  })
})

describe('monogram', () => {
  it('uses the first letter of the name', () => {
    expect(monogram('logankuzyk.com', 'https://logankuzyk.com/').letter).toBe('L')
  })

  it('falls back to the URL when there is no name', () => {
    expect(monogram('  ', 'https://example.com/').letter).toBe('H')
  })

  it('keeps the same colour for a site between sessions', () => {
    const first = monogram('Portfolio', 'https://logankuzyk.com/')
    const again = monogram('Renamed', 'https://logankuzyk.com/')
    const other = monogram('Portfolio', 'https://example.com/')

    expect(first.color).toBe(again.color)
    expect(first.color).toMatch(/^#[0-9a-f]{6}$/)
    expect(other.color).not.toBe(first.color)
  })
})
