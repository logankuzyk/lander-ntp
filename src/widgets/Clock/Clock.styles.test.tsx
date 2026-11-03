import { render } from '@testing-library/preact'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Clock } from './Clock'

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
  /** A number a rule gives a custom property. */
  const number = (selector: string, property: string) => {
    const match = new RegExp(`${property}:\\s*([\\d.]+)`).exec(rule(selector))
    if (!match) throw new Error(`${selector} gives no ${property}`)
    return Number(match[1])
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

  describe('the width and height it reserves', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('takes the smaller of what fits across and what fits down, never the larger', () => {
      expect(rule('.clock')).toMatch(/font-size:\s*min\(/)
      expect(rule('.clock')).not.toMatch(/font-size:\s*max\(/)
    })

    it("reserves at least the widest digit and colon of the four fonts (Geist's and System's digits, Geist Mono's colon)", () => {
      // Measured at 0.599 em for a digit and 0.58 em for the colon, letter-spacing included.
      expect(number('.clock', '--clock-digit')).toBeGreaterThanOrEqual(0.6)
      expect(number('.clock', '--clock-colon')).toBeGreaterThanOrEqual(0.58)
    })

    it('reserves room for every digit and colon the time can draw, in either hour format', () => {
      const allowed = (seconds: boolean) => ({
        colons: number(seconds ? '.clock--seconds' : '.clock', '--clock-colons'),
        digits: number(seconds ? '.clock--seconds' : '.clock', '--clock-digits'),
      })
      // Two-digit hours, the longest a Clock draws: 10:40 to 23:59, and 12-hour 10 to 12.
      const times = [new Date(2026, 8, 11, 23, 59, 59), new Date(2026, 8, 11, 12, 48, 38)]

      for (const hour12 of [false, true]) {
        for (const showSeconds of [false, true]) {
          for (const now of times) {
            vi.setSystemTime(now)
            const { container, unmount } = render(
              <Clock hour12={hour12} showDate={false} showSeconds={showSeconds} />,
            )
            const text = container.querySelector('.clock__time')?.textContent ?? ''
            unmount()

            expect(text.replace(/\D/g, '').length).toBeLessThanOrEqual(allowed(showSeconds).digits)
            expect(text.replace(/\d/g, '').length).toBeLessThanOrEqual(allowed(showSeconds).colons)
          }
        }
      }
    })

    it('reserves the date line: the time (1.05) plus the gap and a line at 0.17em', () => {
      // 1.05 + 0.04 gap + 0.17 * 1.2 line-height = 1.294.
      expect(number('.clock--date', '--clock-lines')).toBeGreaterThanOrEqual(1.29)
    })
  })
})
