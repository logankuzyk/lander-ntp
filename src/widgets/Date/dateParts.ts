export type WeekStart = 'monday' | 'sunday'
export type DateFormat = 'long' | 'short'

const atLocalNoon = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)

/** The first day a locale uses in its calendar, captured as the Date Widget's option default. */
export function firstDayOfWeek(locale = Intl.DateTimeFormat().resolvedOptions().locale): WeekStart {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const firstDay = intlLocale.weekInfo?.firstDay ?? intlLocale.getWeekInfo?.().firstDay
    if (firstDay === undefined) {
      const sundayRegions = new Set([
        'BR',
        'CA',
        'CL',
        'CO',
        'HK',
        'IL',
        'JP',
        'KR',
        'MO',
        'MX',
        'PH',
        'PR',
        'TH',
        'TW',
        'US',
        'VE',
      ])
      return sundayRegions.has(intlLocale.maximize().region ?? '') ? 'sunday' : 'monday'
    }
    return firstDay === 7 ? 'sunday' : 'monday'
  } catch {
    return /^en-US(?:-|$)/i.test(locale) ? 'sunday' : 'monday'
  }
}

/** Seven local dates, starting at the chosen day and containing `date`. */
export function weekStrip(date: Date, startsOn: WeekStart): Date[] {
  const today = atLocalNoon(date)
  const offset = startsOn === 'monday' ? (today.getDay() + 6) % 7 : today.getDay()
  const start = new Date(today)
  start.setDate(today.getDate() - offset)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

/** The month's calendar rows, including adjacent month dates to fill the first and last week. */
export function monthWeeks(date: Date, startsOn: WeekStart): Date[][] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12)
  const offset = startsOn === 'monday' ? (first.getDay() + 6) % 7 : first.getDay()
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  const count = Math.ceil(
    (offset + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7,
  )
  return Array.from({ length: count }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const current = new Date(start)
      current.setDate(start.getDate() + week * 7 + day)
      return current
    }),
  )
}

/** ISO 8601 week number, regardless of the locale's calendar start. */
export function isoWeek(date: Date): number {
  const thursday = atLocalNoon(date)
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
  const firstThursday = new Date(thursday.getFullYear(), 0, 4, 12)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000)
}

/** A date line, localized by the browser with only the choices the Widget exposes. */
export function formatDateLine(
  date: Date,
  { format, locale, showYear = false }: { format: DateFormat; locale?: string; showYear?: boolean },
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: format === 'short' ? 'short' : 'long',
    ...(format === 'short' ? { weekday: 'short' as const } : { weekday: 'long' as const }),
    ...(showYear ? { year: 'numeric' as const } : {}),
  }).format(date)
}

export function formatMonth(
  date: Date,
  locale?: string,
  showYear = true,
  width: 'long' | 'short' = 'long',
): string {
  return new Intl.DateTimeFormat(locale, {
    month: width,
    ...(showYear ? { year: 'numeric' as const } : {}),
  }).format(date)
}

export function formatDay(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(date)
}

export function formatWeekday(
  date: Date,
  locale?: string,
  width: 'long' | 'narrow' | 'short' = 'short',
): string {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(date)
}
