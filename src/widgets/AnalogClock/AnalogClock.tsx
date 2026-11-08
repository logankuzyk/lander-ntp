import { useEffect, useState } from 'preact/hooks'

import { formatTime } from '@/utils/time'

import type { AnalogClockOptions } from './definition'
import { handAngles } from './handAngles'

type AnalogClockProps = AnalogClockOptions & { hour12?: boolean; locale?: string }

function useClock(showSeconds: boolean) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const stop = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
    const schedule = () => {
      stop()
      if (document.visibilityState === 'hidden') return
      const period = showSeconds ? 1000 : 60_000
      timer = setTimeout(
        () => {
          setNow(new Date())
          schedule()
        },
        period - (Date.now() % period),
      )
    }
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') stop()
      else {
        setNow(new Date())
        schedule()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', visibilityChanged)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
  }, [showSeconds])

  return now
}

const points = (radius: number, count: number, inner: number) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index * Math.PI * 2) / count
    return {
      x1: 50 + Math.sin(angle) * inner,
      x2: 50 + Math.sin(angle) * radius,
      y1: 50 - Math.cos(angle) * inner,
      y2: 50 - Math.cos(angle) * radius,
    }
  })

export function AnalogClock({
  face,
  hour12 = false,
  locale,
  showDate,
  showSeconds,
}: AnalogClockProps) {
  const now = useClock(showSeconds)
  const angles = handAngles(now)
  const label = formatTime(now, { hour12, locale, showSeconds: false })
  const ticks = points(43, 60, 40)

  return (
    <div class={`analog-clock analog-clock--${face}`}>
      <svg
        aria-label={`Analog clock, ${label}`}
        class="analog-clock__dial"
        role="img"
        viewBox="0 0 100 100"
      >
        <circle class="analog-clock__rim" cx="50" cy="50" r="47" />
        {face === 'ticks' &&
          ticks.map(({ x1, x2, y1, y2 }, index) => (
            <line class="analog-clock__tick" key={index} x1={x1} x2={x2} y1={y1} y2={y2} />
          ))}
        {face === 'numerals' &&
          Array.from({ length: 12 }, (_, index) => {
            const number = index === 0 ? 12 : index
            const angle = (index * Math.PI * 2) / 12
            return (
              <text
                class="analog-clock__numeral"
                dominant-baseline="central"
                key={number}
                text-anchor="middle"
                x={50 + Math.sin(angle) * 33}
                y={50 - Math.cos(angle) * 33}
              >
                {number}
              </text>
            )
          })}
        <line
          class="analog-clock__hand analog-clock__hand--hour"
          transform={`rotate(${angles.hour} 50 50)`}
          x1="50"
          x2="50"
          y1="50"
          y2="25"
        />
        <line
          class="analog-clock__hand analog-clock__hand--minute"
          transform={`rotate(${angles.minute} 50 50)`}
          x1="50"
          x2="50"
          y1="50"
          y2="13"
        />
        {showSeconds && (
          <line
            class="analog-clock__hand analog-clock__hand--second"
            key={now.getSeconds()}
            transform={`rotate(${angles.second} 50 50)`}
            x1="50"
            x2="50"
            y1="50"
            y2="7"
          />
        )}
        <circle class="analog-clock__pin" cx="50" cy="50" r="2" />
        {showDate && (
          <g aria-hidden="true">
            <rect class="analog-clock__date-window" height="10" rx="1" width="10" x="68" y="45" />
            <text class="analog-clock__date" textAnchor="middle" x="73" y="52">
              {now.getDate()}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
