import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { WEATHER_FIELDS, type WeatherField } from '@/settings/schema'
import type { Weather as Reading } from '@/weather/openMeteo'

import { Weather } from './Weather'

const READING: Reading = {
  code: 61,
  feelsLike: 9.6,
  high: 16.1,
  isDay: true,
  low: 9.3,
  sunrise: '2026-10-01T07:13',
  sunset: '2026-10-01T18:51',
  temperature: 12.3,
}

const renderWeather = (
  shown: WeatherField[] = [],
  props: { background?: boolean; hour12?: boolean; reading?: Reading } = {},
) =>
  render(
    <Weather
      background={props.background ?? false}
      fields={[
        ...shown.map((id) => ({ id, shown: true })),
        ...WEATHER_FIELDS.filter((id) => !shown.includes(id)).map((id) => ({ id, shown: false })),
      ]}
      hour12={props.hour12 ?? false}
      place="Victoria"
      weather={props.reading ?? READING}
    />,
  )

describe('Weather', () => {
  it('shows the rounded temperature with an icon, and says the conditions', () => {
    const { container } = renderWeather()

    expect(container.querySelector('.weather__temperature')?.textContent).toBe('12°')
    expect(container.querySelector('.weather__now svg')).not.toBeNull()
    expect(screen.getByText('Light rain')).toBeTruthy()
    expect(container.querySelector('.weather__details')).toBeNull()
  })

  it('shows only the lines that are switched on', () => {
    const { container } = renderWeather(['location', 'feelsLike'])

    const lines = [...container.querySelectorAll('.weather__details li')]
    expect(lines.map((line) => line.textContent)).toEqual(['Victoria', 'Feels like 10°'])
  })

  it('draws the lines in the order they are given', () => {
    const { container } = renderWeather(['feelsLike', 'location'])

    const lines = [...container.querySelectorAll('.weather__details li')]
    expect(lines.map((line) => line.textContent)).toEqual(['Feels like 10°', 'Victoria'])
  })

  it('shows the high and low', () => {
    const { container } = renderWeather(['highLow'])

    expect(container.querySelector('.weather__details')?.textContent).toBe('H 16° · L 9°')
  })

  it('shows sunrise and sunset as the place has them, in 24-hour time', () => {
    renderWeather(['sun'])

    expect(screen.getByLabelText('Sunrise').textContent).toBe('07:13')
    expect(screen.getByLabelText('Sunset').textContent).toBe('18:51')
  })

  it('follows the 12-hour setting', () => {
    renderWeather(['sun'], { hour12: true })

    expect(screen.getByLabelText('Sunrise').textContent).toBe('7:13')
    expect(screen.getByLabelText('Sunset').textContent).toBe('6:51')
  })

  it('leaves out sunrise and sunset where the sun does neither today', () => {
    const midnight = '2026-10-01T00:00'
    const { container } = renderWeather(['sun', 'location'], {
      reading: { ...READING, sunrise: midnight, sunset: midnight },
    })

    const lines = [...container.querySelectorAll('.weather__details li')]
    expect(lines.map((line) => line.textContent)).toEqual(['Victoria'])
  })

  it('sits on the panel only when asked to', () => {
    expect(renderWeather().container.querySelector('.weather--panel')).toBeNull()
    expect(
      renderWeather([], { background: true }).container.querySelector('.weather--panel'),
    ).not.toBeNull()
  })
})
