export interface FormatTimeOptions {
  hour12?: boolean
  locale?: string
}

/** Format a date as hours and minutes, e.g. "9:05" (12h) or "21:05" (24h). */
export function formatTime(date: Date, { hour12 = false, locale }: FormatTimeOptions = {}): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: hour12 ? 'h12' : 'h23',
  })
    .formatToParts(date)
    .filter((part) => part.type !== 'dayPeriod')
    .map((part) => part.value)
    .join('')
    .trim()
}
