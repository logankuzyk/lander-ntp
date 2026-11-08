import { describe, expect, it } from 'vitest'

import { firstDayOfWeek, formatDateLine, isoWeek, monthWeeks, weekStrip } from './dateParts'

const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)

describe('Date parts', () => {
  it.each([
    { date: localDate(2027, 2, 1), startsOn: 'monday', weeks: 4 },
    { date: localDate(2026, 6, 1), startsOn: 'monday', weeks: 5 },
    { date: localDate(2026, 8, 1), startsOn: 'monday', weeks: 6 },
  ] as const)(
    'lays out $date as a $weeks-week month starting $startsOn',
    ({ date, startsOn, weeks }) => {
      expect(monthWeeks(date, startsOn)).toHaveLength(weeks)
      expect(monthWeeks(date, startsOn)[0]).toHaveLength(7)
    },
  )

  it('uses Monday or Sunday as the first day and includes the surrounding dates', () => {
    const monday = monthWeeks(localDate(2026, 8, 1), 'monday')
    const sunday = monthWeeks(localDate(2026, 8, 1), 'sunday')
    expect(monday[0]![0]).toEqual(localDate(2026, 7, 27))
    expect(sunday[0]![0]).toEqual(localDate(2026, 7, 26))
  })

  it('rings today in the month and calculates ISO week numbers across a year boundary', () => {
    expect(isoWeek(localDate(2021, 1, 1))).toBe(53)
    expect(isoWeek(localDate(2021, 1, 4))).toBe(1)
    expect(isoWeek(localDate(2025, 12, 29))).toBe(1)
    expect(firstDayOfWeek('en-US')).toBe('sunday')
    expect(firstDayOfWeek('en-GB')).toBe('monday')
  })

  it.each([
    ['en-US', 'Sat, Oct 18'],
    ['en-CA', 'Sat, Oct 18'],
    ['de', 'Sa., 18. Okt.'],
  ])('formats a short date for %s', (locale, expected) => {
    expect(formatDateLine(localDate(2025, 10, 18), { format: 'short', locale })).toBe(expected)
  })

  it('draws a week strip that contains today and begins on the chosen day', () => {
    expect(weekStrip(localDate(2026, 8, 5), 'monday').map((date) => date.getDate())).toEqual([
      3, 4, 5, 6, 7, 8, 9,
    ])
    expect(weekStrip(localDate(2026, 8, 5), 'sunday').map((date) => date.getDate())).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ])
  })
})
