import { Sunrise, Sunset } from 'lucide-preact'
import type { ComponentChildren } from 'preact'

import type { WeatherField, WeatherSettings } from '@/settings/schema'
import { formatTime } from '@/utils/time'
import { describeCode } from '@/weather/conditions'
import type { Weather as Reading } from '@/weather/openMeteo'

import { ConditionIcon } from './ConditionIcon'

type WeatherProps = {
  background: boolean
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

/** Top right: the weather now, over the optional lines that are switched on, in their order. */
export function Weather({ background, fields, hour12, place, weather }: WeatherProps) {
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
        <Sunrise aria-hidden="true" size={16} />
        <SunTime at={weather.sunrise} hour12={hour12} label="Sunrise" />
        <Sunset aria-hidden="true" size={16} />
        <SunTime at={weather.sunset} hour12={hour12} label="Sunset" />
      </li>
    ),
  }

  return (
    <section aria-label="Weather" class={background ? 'weather weather--panel' : 'weather'}>
      <div class="weather__now" title={label}>
        <ConditionIcon condition={condition} isDay={weather.isDay} size={36} />
        <span class="weather__temperature">{degrees(weather.temperature)}</span>
        {/* The icon says it for the eye; with the line below switched on, that says it. */}
        {!shown.includes('condition') && <span class="visually-hidden">{label}</span>}
      </div>
      {shown.length > 0 && <ul class="weather__details">{shown.map((id) => lines[id]())}</ul>}
    </section>
  )
}
