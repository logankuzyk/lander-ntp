import { describe, expect, it } from 'vitest'

import { SLACK, weatherFit } from './fit'

const NONE = { lines: [], place: null, sun: false, temperature: '12°' }
const ALL = {
  lines: ['Partly cloudy', 'Feels like 11°', 'H 16° · L 8°'],
  place: 'Victoria',
  sun: true,
  temperature: '13°',
}

describe('the room a Weather reserves', () => {
  it('is the temperature and its icon alone when no line is on', () => {
    // The temperature row: 2.5 em at a line height of 1.1.
    expect(weatherFit(NONE).height).toBeCloseTo(2.75)
  })

  it('grows by a line, and the gap between lines, for each line that is on', () => {
    const one = weatherFit({ ...NONE, place: 'Victoria' }).height
    const two = weatherFit({ ...NONE, lines: ['Clear'], place: 'Victoria' }).height

    // The gap under the temperature, and one line at 1.25 em.
    expect(one - weatherFit(NONE).height).toBeCloseTo(0.4 + 1.25)
    // Another line, and the gap above it.
    expect(two - one).toBeCloseTo(1.25 + 0.125)
  })

  it('counts the sun as a line', () => {
    const without = weatherFit({ ...NONE, place: 'Victoria' })
    const withSun = weatherFit({ ...NONE, place: 'Victoria', sun: true })

    expect(withSun.height - without.height).toBeCloseTo(1.25 + 0.125)
  })

  it('never needs less room for more: turning a line on never shrinks the reservation', () => {
    const everything = weatherFit(ALL)
    for (const lines of [[], ALL.lines.slice(0, 1), ALL.lines]) {
      for (const sun of [false, true]) {
        const part = weatherFit({ lines, place: null, sun, temperature: ALL.temperature })
        expect(part.height).toBeLessThanOrEqual(everything.height)
        expect(part.width).toBeLessThanOrEqual(everything.width)
      }
    }
  })

  it('is as wide as the widest of the temperature row and the lines', () => {
    const narrow = weatherFit(NONE).width
    const wide = weatherFit({ ...NONE, lines: ['Thunderstorm with hail'] }).width

    expect(wide).toBeGreaterThan(narrow)
    // 22 characters, at the widest of the four fonts' advance.
    expect(wide).toBeCloseTo(22 * 0.6 * SLACK)
  })

  it('leaves a long place name to be cut short rather than make everything else small', () => {
    const long = weatherFit({
      ...NONE,
      place: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch',
    })
    const current = weatherFit({ ...NONE, place: 'Current location' })

    expect(long.width).toBeCloseTo(current.width)
  })

  it('reserves a wider temperature for a longer reading', () => {
    expect(weatherFit({ ...NONE, temperature: '-12°' }).width).toBeGreaterThan(
      weatherFit({ ...NONE, temperature: '9°' }).width,
    )
  })
})
