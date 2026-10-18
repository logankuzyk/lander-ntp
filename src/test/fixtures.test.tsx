import { render, screen } from '@testing-library/preact'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import { WEATHER_FIELDS } from '@/settings/schema'
import { Weather } from '@/widgets/Weather/Weather'

import { makeWeather, STORY_PHOTOS } from './fixtures'

describe('makeWeather', () => {
  it('is a reading the Weather draws in full, sunrise and sunset included', () => {
    const { container } = render(
      <Weather
        fields={WEATHER_FIELDS.map((id) => ({ id, shown: true }))}
        hour12={false}
        place="Victoria"
        weather={makeWeather()}
      />,
    )

    expect(container.querySelector('.weather__temperature')?.textContent).toMatch(/^-?\d+°$/)
    expect(screen.getByText(/^Feels like -?\d+°$/)).toBeTruthy()
    expect(screen.getByTitle('High')).toBeTruthy()
    expect(screen.getByLabelText('Sunrise').textContent).toMatch(/^\d\d:\d\d$/)
    expect(screen.getByLabelText('Sunset').textContent).toMatch(/^\d\d:\d\d$/)
    expect(container.querySelectorAll('.weather__details li')).toHaveLength(WEATHER_FIELDS.length)
  })

  it('gives sunrise and sunset as local times with no offset, as the forecast does', () => {
    const { sunrise, sunset } = makeWeather()
    const LocalTime = v.pipe(v.string(), v.isoDateTime())

    expect(v.is(LocalTime, sunrise)).toBe(true)
    expect(v.is(LocalTime, sunset)).toBe(true)
    expect(sunrise < sunset).toBe(true)
  })

  it('takes overrides for any part of the reading', () => {
    const reading = makeWeather({ code: 95, isDay: false, temperature: -4 })

    expect(reading).toMatchObject({ code: 95, isDay: false, temperature: -4 })
  })
})

/** Every string anywhere inside a value. */
const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

describe('STORY_PHOTOS', () => {
  it('holds no remote URL, so a story never loads from the network', () => {
    const remote = strings(STORY_PHOTOS).filter((text) => /^(https?:)?\/\//i.test(text))

    expect(remote).toEqual([])
  })

  it('draws every photo from the fallback that Storybook serves', () => {
    const urls = STORY_PHOTOS.flatMap((photo) => photo.sizes.map((size) => size.url))

    expect(urls.length).toBeGreaterThan(0)
    expect(new Set(urls)).toEqual(new Set(['/fallback.webp']))
  })

  it('gives each photo its own id, a location and tags, as the credit and gallery show them', () => {
    expect(STORY_PHOTOS.length).toBeGreaterThanOrEqual(2)
    expect(new Set(STORY_PHOTOS.map((photo) => photo.id)).size).toBe(STORY_PHOTOS.length)
    for (const photo of STORY_PHOTOS) {
      expect(photo.location).toBeTruthy()
      expect(photo.tags.length).toBeGreaterThan(0)
    }
  })
})
