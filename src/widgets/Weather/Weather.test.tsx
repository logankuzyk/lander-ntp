import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { WEATHER_FIELDS, type WeatherField } from '@/settings/schema'
import type { Weather as Reading } from '@/weather/openMeteo'
import { defaultOptions } from '@/widgetSystem/options'
import { Box } from '@/widgetSystem/WidgetBox'

import { weatherDefinition } from './definition'
import { weatherFit } from './fit'
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
  props: { hour12?: boolean; reading?: Reading } = {},
) =>
  render(
    <Weather
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

  it('reserves room for what it draws, in custom properties the styles size it by', () => {
    const { container } = renderWeather(['location', 'feelsLike', 'sun'])

    const weather = container.querySelector<HTMLElement>('.weather')
    const fit = weatherFit({
      lines: ['Feels like 10°'],
      place: 'Victoria',
      sun: true,
      temperature: '12°',
    })
    expect(Number(weather?.style.getPropertyValue('--weather-width'))).toBeCloseTo(fit.width)
    expect(Number(weather?.style.getPropertyValue('--weather-height'))).toBeCloseTo(fit.height)
  })

  it('reserves no room for the sun where the sun does neither today', () => {
    const midnight = '2026-10-01T00:00'
    const { container } = renderWeather(['sun'], {
      reading: { ...READING, sunrise: midnight, sunset: midnight },
    })

    const weather = container.querySelector<HTMLElement>('.weather')
    const fit = weatherFit({ lines: [], place: null, sun: false, temperature: '12°' })
    expect(Number(weather?.style.getPropertyValue('--weather-height'))).toBeCloseTo(fit.height)
  })

  it('draws the icons in ems, so they scale with the type', () => {
    const { container } = renderWeather(['sun'])

    for (const icon of container.querySelectorAll('svg')) {
      expect(icon.getAttribute('width')).toMatch(/em$/)
    }
  })
})

describe('the Weather at its smallest size', () => {
  it('draws all five lines, with nothing hidden by markup, so the box only has to be big enough', () => {
    const { smallest } = weatherDefinition.sizes
    const options = defaultOptions(weatherDefinition)
    const { View } = weatherDefinition
    const { container } = render(
      <Box name="Weather" rect={{ col: 11, row: 1, ...smallest }} widget="weather">
        <View
          context="Victoria"
          options={{ ...options, fields: options.fields.map((f) => ({ ...f, shown: true })) }}
          page={{ hour12: false }}
          reading={READING}
        />
      </Box>,
    )

    const lines = [...container.querySelectorAll<HTMLElement>('.weather__details li')]
    expect(lines.map((line) => line.textContent)).toEqual([
      'H 16° · L 9°',
      'Victoria',
      '07:1318:51',
      'Light rain',
      'Feels like 10°',
    ])
    for (const line of lines) {
      expect(line.hidden).toBe(false)
      expect(line.closest('[aria-hidden="true"], [hidden]')).toBeNull()
      expect(line.style.display).not.toBe('none')
    }
  })
})
