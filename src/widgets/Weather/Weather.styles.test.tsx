import { describe, expect, it } from 'vitest'

import { css, rule } from '@/test/styles'

import { LINE_GAP, LINE_HEIGHT, NOW_GAP, NOW_HEIGHT, NOW_ICON_GAP, NOW_SIZE } from './fit'

/**
 * happy-dom cannot lay anything out, so these only guard the rules that were measured to matter
 * (in a real browser, on the built Storybook; the measurements are in the pull request).
 */
describe('the Weather styles', () => {
  it("sizes the Weather by its box (container query units), never by the window's width", () => {
    const size = rule('.weather')
    expect(size).toMatch(/font-size:[^;]*cqw/)
    expect(size).toMatch(/font-size:[^;]*cqh/)
    expect(size).not.toMatch(/[\d.]vw|[\d.]vh/)
  })

  it('takes the smaller of what fits across and what fits down, with no cap or floor', () => {
    const size = /font-size:([^;]*);/.exec(rule('.weather'))?.[1] ?? ''
    expect(size).toMatch(/^\s*min\(/)
    expect(size).not.toMatch(/max\(|clamp\(|rem|px/)
  })

  it('works out the width and the height from the custom properties the Weather sets', () => {
    const size = rule('.weather')
    expect(size).toContain('var(--weather-width)')
    expect(size).toContain('var(--weather-height)')
  })

  it('is not fixed to the window, nor sized in rem or pixels', () => {
    expect(rule('.weather')).not.toMatch(/position:\s*fixed/)
    for (const selector of ['.weather', '.weather__now', '.weather__details']) {
      expect(rule(selector)).not.toMatch(/font-size:[^;]*(rem|px)/)
    }
  })

  it('keeps the rows at the sizes the room it reserves is worked out from', () => {
    expect(rule('.weather__now')).toContain(`font-size: ${NOW_SIZE}em`)
    expect(rule('.weather__now')).toContain(`line-height: ${NOW_HEIGHT / NOW_SIZE}`)
    expect(rule('.weather__now')).toContain(`gap: ${NOW_ICON_GAP}em`)
    expect(rule('.weather')).toContain(`gap: ${NOW_GAP}em`)
    expect(rule('.weather__details')).toContain(`gap: ${LINE_GAP}em`)
    expect(rule('.weather__details')).toContain(`line-height: ${LINE_HEIGHT}`)
  })

  it('draws the icons in ems of the type, so they scale with it', () => {
    expect(css).toMatch(/\.weather__now svg\s*{[^}]*width:\s*1em/)
    expect(css).toMatch(/\.weather__sun svg\s*{[^}]*width:\s*1\.15em/)
  })

  it('cuts a line that is wider than the box short, rather than spill out of it', () => {
    const line = rule('.weather__details li')
    expect(line).toMatch(/overflow:\s*hidden/)
    expect(line).toMatch(/text-overflow:\s*ellipsis/)
    expect(line).toMatch(/white-space:\s*nowrap/)
    expect(rule('.weather')).toMatch(/max-width:\s*100cqw/)
  })

  it('leaves the box to centre what is wider than it, with no overflow of its own to scroll', () => {
    expect(rule('.widget-box')).toMatch(/justify-content:\s*center/)
    expect(rule('.weather')).not.toMatch(/overflow:\s*(auto|scroll)/)
  })
})
