import { useEffect, useState } from 'preact/hooks'

import type { Cells } from '@/widgetSystem/definition'

import {
  type DateFormat,
  formatDateLine,
  formatDay,
  formatMonth,
  formatWeekday,
  isoWeek,
  monthWeeks,
  type WeekStart,
  weekStrip,
} from './dateParts'

export type DateProps = {
  cells: Cells
  format: DateFormat
  locale?: string
  monthGrid: boolean
  showYear: boolean
  simulatedToday?: Date
  weekNumbers: boolean
  weekStartsOn: WeekStart
}

/** Re-renders at local midnight and when a background tab becomes visible again. */
function useToday(simulatedToday?: Date) {
  const [today, setToday] = useState(() => simulatedToday ?? new globalThis.Date())

  useEffect(() => {
    if (simulatedToday) return
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      setToday(new globalThis.Date())
      schedule()
    }
    const schedule = () => {
      clearTimeout(timer)
      const now = new globalThis.Date()
      const midnight = new globalThis.Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, midnight.getTime() - now.getTime())
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [simulatedToday])

  return today
}

export function Date({
  cells,
  format,
  locale,
  monthGrid,
  showYear,
  simulatedToday,
  weekNumbers,
  weekStartsOn,
}: DateProps) {
  const today = useToday(simulatedToday)
  const isWeekStrip = cells.w >= 5 && cells.h <= 2
  const isMonthGrid = !isWeekStrip && monthGrid && cells.w >= 3 && cells.h >= 3
  const isLine = !isWeekStrip && !isMonthGrid && cells.h === 1

  if (isWeekStrip) {
    const days = weekStrip(today, weekStartsOn)
    return (
      <div aria-label={formatMonth(today, locale)} class="date date--week">
        {days.map((day) => (
          <time
            aria-current={day.toDateString() === today.toDateString() ? 'date' : undefined}
            class="date__week-day"
            dateTime={day.toISOString()}
            key={day.toISOString()}
          >
            <span>{formatWeekday(day, locale, format === 'short' ? 'narrow' : 'long')}</span>
            <strong>{formatDay(day, locale)}</strong>
          </time>
        ))}
      </div>
    )
  }

  if (isMonthGrid) {
    const weeks = monthWeeks(today, weekStartsOn)
    return (
      <div class={`date date--grid${format === 'long' ? ' date--long' : ''}`}>
        <strong class="date__month">
          {formatMonth(today, locale, showYear, format === 'short' ? 'short' : 'long')}
        </strong>
        <div class={`date__calendar${weekNumbers ? ' date__calendar--weeks' : ''}`}>
          {weekNumbers && (
            <span aria-hidden="true" class="date__week-number-label">
              #
            </span>
          )}
          {weeks[0]!.map((day) => (
            <span
              class="date__weekday"
              key={`weekday-${day.getDay()}`}
              title={format === 'long' ? formatWeekday(day, locale, 'long') : undefined}
            >
              {formatWeekday(day, locale, format === 'short' ? 'narrow' : 'long')}
            </span>
          ))}
          {weeks.flatMap((week, index) => [
            ...(weekNumbers
              ? [
                  <span class="date__week-number" key={`week-${index}`}>
                    {isoWeek(week.find((day) => day.getDay() === 4)!)}
                  </span>,
                ]
              : []),
            ...week.map((day) => (
              <time
                aria-current={day.toDateString() === today.toDateString() ? 'date' : undefined}
                class={`date__grid-day${day.getMonth() === today.getMonth() ? '' : ' date__grid-day--outside'}`}
                dateTime={day.toISOString()}
                key={day.toISOString()}
              >
                {formatDay(day, locale)}
              </time>
            )),
          ])}
        </div>
      </div>
    )
  }

  if (isLine) {
    return (
      <time
        class={`date date--line${format === 'long' ? ' date--long' : ''}`}
        dateTime={today.toISOString()}
      >
        {formatDateLine(today, { format, locale, showYear })}
      </time>
    )
  }

  return (
    <div class="date date--card">
      <span class="date__card-weekday">
        {formatWeekday(today, locale, format === 'short' ? 'short' : 'long')}
      </span>
      <strong class="date__card-day">{formatDay(today, locale)}</strong>
      <span class="date__card-month">
        {new Intl.DateTimeFormat(locale, {
          month: format === 'short' ? 'short' : 'long',
          ...(showYear ? { year: 'numeric' } : {}),
        }).format(today)}
      </span>
    </div>
  )
}
