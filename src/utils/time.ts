export interface FormatTimeOptions {
  hour12?: boolean
  locale?: string
  showSeconds?: boolean
}

/** Format a date as hours and minutes, e.g. "9:05" (12h) or "21:05" (24h). */
export function formatTime(
  date: Date,
  { hour12 = false, locale, showSeconds = false }: FormatTimeOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(showSeconds && { second: '2-digit' }),
    hourCycle: hour12 ? 'h12' : 'h23',
  })
    .formatToParts(date)
    .filter((part) => part.type !== 'dayPeriod')
    .map((part) => part.value)
    .join('')
    .trim()
}

/**
 * Format an ISO date from the manifest in the viewer's locale, e.g. "30 June 2025". Returns
 * an empty string when there is no date or it can't be read.
 */
export function formatDateTaken(value: string | undefined, locale?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date)
}

/** Format a date as a weekday and day, e.g. "Friday, 11 September". */
export function formatDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
