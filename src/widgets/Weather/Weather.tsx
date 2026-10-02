import { Sunrise, Sunset } from 'lucide-preact'
import type { ComponentChildren } from 'preact'

import type { WeatherField, WeatherSettings } from '@/settings/schema'
import { formatTime } from '@/utils/time'
import { describeCode } from '@/weather/conditions'
import type { Weather as Reading } from '@/weather/openMeteo'

import { ConditionIcon } from './ConditionIcon'

type WeatherProps = {
  weather: Reading
  /** The name of the place the reading is for. */
  place: string
  fields: WeatherSettings['fields']
  background: boolean
  /** The clock's setting, so every time on the page reads the same way. */
  hour12: boolean
}

const degrees = (value: number) => `${Math.round(value)}°`

/**
 * The forecast gives sunrise and sunset as wall-clock time at the place. Reading that as UTC
 * and formatting it as UTC keeps it there, whatever zone the browser is in.
 */
function SunTime({ label, at, hour12 }: { label: string; at: string; hour12: boolean }) {
  return (
    <time dateTime={at} aria-label={label}>
      {formatTime(new Date(`${at}Z`), { hour12, timeZone: 'UTC' })}
    </time>
  )
}

/** Top right: the weather now, over the optional lines that are switched on, in their order. */
export function Weather({ weather, place, fields, background, hour12 }: WeatherProps) {
  const { condition, label } = describeCode(weather.code)
  const shown = fields.filter((field) => field.shown).map((field) => field.id)

  const lines: Record<WeatherField, () => ComponentChildren> = {
    location: () => <li key="location">{place}</li>,
    condition: () => <li key="condition">{label}</li>,
    feelsLike: () => <li key="feelsLike">Feels like {degrees(weather.feelsLike)}</li>,
    highLow: () => (
      <li key="highLow">
        <abbr title="High">H</abbr> {degrees(weather.high)} · <abbr title="Low">L</abbr>{' '}
        {degrees(weather.low)}
      </li>
    ),
    sun: () => (
      <li key="sun" class="weather__sun">
        <Sunrise aria-hidden="true" size={16} />
        <SunTime label="Sunrise" at={weather.sunrise} hour12={hour12} />
        <Sunset aria-hidden="true" size={16} />
        <SunTime label="Sunset" at={weather.sunset} hour12={hour12} />
      </li>
    ),
  }

  return (
    <section class={background ? 'weather weather--panel' : 'weather'} aria-label="Weather">
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
