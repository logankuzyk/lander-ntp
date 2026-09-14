import { useEffect, useState } from 'preact/hooks'

import type { Settings } from '@/settings/schema'
import { formatDate, formatTime } from '@/utils/time'

type ClockProps = Omit<Settings['clock'], 'enabled'> & {
  /** Overrides the browser locale; for tests. */
  locale?: string
}

export function Clock({ hour12, showDate, showSeconds, locale }: ClockProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Tick on the second (or minute) boundary rather than drifting by a whole interval.
    const period = showSeconds ? 1000 : 60_000
    let timer = 0 as unknown as ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date())
          schedule()
        },
        period - (Date.now() % period),
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [showSeconds])

  return (
    <div class="clock">
      <time class="clock__time" dateTime={now.toISOString()}>
        {formatTime(now, { hour12, showSeconds, locale })}
      </time>
      {showDate && <span class="clock__date">{formatDate(now, locale)}</span>}
    </div>
  )
}
