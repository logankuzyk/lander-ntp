import { Sunrise, Sunset } from 'lucide-preact'
import type { ComponentChildren, JSX } from 'preact'

import type { WeatherField, WeatherSettings } from '@/settings/schema'
import { formatTime } from '@/utils/time'
import { describeCode } from '@/weather/conditions'
import type { Weather as Reading } from '@/weather/openMeteo'

import { ConditionIcon } from './ConditionIcon'
import { weatherFit } from './fit'

type WeatherProps = {
  fields: WeatherSettings['fields']
  /** The clock's setting, so every time on the page reads the same way. */
  hour12: boolean
  /** The name of the place the reading is for. */
  place: string
  weather: Reading
}

const degrees = (value: number) => `${Math.round(value)}°`

/**
 * The forecast gives sunrise and sunset as wall-clock time at the place. Reading that as UTC
 * and formatting it as UTC keeps it there, whatever zone the browser is in.
 */
function SunTime({ at, hour12, label }: { at: string; hour12: boolean; label: string }) {
  return (
    <time aria-label={label} dateTime={at}>
      {formatTime(new Date(`${at}Z`), { hour12, timeZone: 'UTC' })}
    </time>
  )
}

/**
 * The weather now, over the optional lines that are switched on, in their order. It fills its
 * box: the styles size the type from the room it says it needs (see `weatherFit`), the most the
 * box can give at which what is drawn fits across and down.
 */
export function Weather({ fields, hour12, place, weather }: WeatherProps) {
  const { condition, label } = describeCode(weather.code)
  // Where the sun doesn't rise or set today, the forecast gives both as the same midnight.
  const noSun = weather.sunrise === weather.sunset
  const shown = fields
    .filter((field) => field.shown && !(field.id === 'sun' && noSun))
    .map((field) => field.id)

  const lines: Record<WeatherField, () => ComponentChildren> = {
    condition: () => <li key="condition">{label}</li>,
    feelsLike: () => <li key="feelsLike">Feels like {degrees(weather.feelsLike)}</li>,
    highLow: () => (
      <li key="highLow">
        <abbr title="High">H</abbr> {degrees(weather.high)} · <abbr title="Low">L</abbr>{' '}
        {degrees(weather.low)}
      </li>
    ),
    location: () => <li key="location">{place}</li>,
    sun: () => (
      <li class="weather__sun" key="sun">
        <Sunrise aria-hidden="true" size="1.15em" />
        <SunTime at={weather.sunrise} hour12={hour12} label="Sunrise" />
        <Sunset aria-hidden="true" size="1.15em" />
        <SunTime at={weather.sunset} hour12={hour12} label="Sunset" />
      </li>
    ),
  }

  const temperature = degrees(weather.temperature)
  const fit = weatherFit({
    // The lines other than the place and the sun, as drawn.
    lines: [
      ...(shown.includes('condition') ? [label] : []),
      ...(shown.includes('feelsLike') ? [`Feels like ${degrees(weather.feelsLike)}`] : []),
      ...(shown.includes('highLow')
        ? [`H ${degrees(weather.high)} · L ${degrees(weather.low)}`]
        : []),
    ],
    place: shown.includes('location') ? place : null,
    sun: shown.includes('sun'),
    temperature,
  })

  return (
    <section
      aria-label="Weather"
      class="weather"
      style={{ '--weather-height': fit.height, '--weather-width': fit.width } as JSX.CSSProperties}
    >
      <div class="weather__now" title={label}>
        <ConditionIcon condition={condition} isDay={weather.isDay} size="1em" />
        <span class="weather__temperature">{temperature}</span>
        {/* The icon says it for the eye; with the line below switched on, that says it. */}
        {!shown.includes('condition') && <span class="visually-hidden">{label}</span>}
      </div>
      {shown.length > 0 && <ul class="weather__details">{shown.map((id) => lines[id]())}</ul>}
    </section>
  )
}
