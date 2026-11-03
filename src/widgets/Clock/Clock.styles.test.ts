import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * happy-dom cannot lay anything out, so these only guard the rules that were measured to matter
 * (in a real browser, on the built Storybook; the measurements are in the pull request).
 */
describe('the Clock styles', () => {
  const css = readFileSync(join(process.cwd(), 'src/entrypoints/newtab/style.css'), 'utf8')
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`)
    if (start === -1) throw new Error(`no rule for ${selector}`)
    return css.slice(start, css.indexOf('}', start))
  }

  it("sizes the Clock by its box (container query units), never by the window's width", () => {
    const size = rule('.clock')
    expect(size).toMatch(/font-size:[^;]*cqw/)
    expect(size).toMatch(/font-size:[^;]*cqh/)
    expect(rule('.clock__time')).not.toMatch(/[\d.]vw/)
    expect(rule('.clock__date')).not.toMatch(/[\d.]vw/)
  })

  it('has no cap on the digits: no 9rem, and the time and date follow the Clock', () => {
    expect(css).not.toMatch(/clamp\(4rem, 16vw, 9rem\)/)
    expect(rule('.clock')).not.toMatch(/9rem/)
    expect(rule('.clock__time')).toMatch(/font-size:\s*1em/)
  })

  it('keeps the date legible at the smallest size with a floor, as the time has none', () => {
    expect(rule('.clock__date')).toMatch(/font-size:\s*max\(0\.17em,\s*0\.75rem\)/)
  })

  it('keeps the time and the date together, centred when wider than the box', () => {
    expect(rule('.clock')).toMatch(/justify-items:\s*center/)
    expect(rule('.clock')).toMatch(/text-align:\s*center/)
  })

  it('works out the width from how many digits and colons it draws, and the height from its lines', () => {
    expect(rule('.clock--seconds')).toMatch(/--clock-digits/)
    expect(rule('.clock--date')).toMatch(/--clock-lines/)
  })
})
