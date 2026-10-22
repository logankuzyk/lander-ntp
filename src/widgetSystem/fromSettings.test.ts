import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'

import { pageValues, widgetsFromSettings } from './fromSettings'

const withClock = (clock: Partial<Settings['clock']>): Settings => ({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, ...clock },
})

describe('widgetsFromSettings', () => {
  it('gives one Clock with its options when the clock is on', () => {
    const settings = withClock({ enabled: true, showDate: true, showSeconds: false })
    expect(widgetsFromSettings(settings)).toEqual([
      { options: { showDate: true, showSeconds: false }, type: 'clock' },
    ])
  })

  it('gives no Clock when the clock is off', () => {
    expect(widgetsFromSettings(withClock({ enabled: false }))).toEqual([])
  })

  it('leaves 12/24-hour time out of the Clock, and the Weather out while it is off', () => {
    expect(widgetsFromSettings(withClock({ hour12: true }))).toEqual([
      { options: { showDate: false, showSeconds: false }, type: 'clock' },
    ])
  })
})

describe('widgetsFromSettings with the weather', () => {
  const PLACE = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }
  const FIELDS: Settings['weather']['fields'] = [
    { id: 'sun', shown: true },
    { id: 'location', shown: false },
    { id: 'highLow', shown: true },
    { id: 'condition', shown: false },
    { id: 'feelsLike', shown: true },
  ]
  const withWeather = (weather: Partial<Settings['weather']>, clockOn = true): Settings => ({
    ...withClock({ enabled: clockOn }),
    weather: { ...DEFAULT_SETTINGS.weather, ...weather },
  })

  it('gives a Weather after the Clock, with its options, when the weather is on', () => {
    const settings = withWeather({
      enabled: true,
      fields: FIELDS,
      followDevice: false,
      place: PLACE,
      unit: 'fahrenheit',
    })
    expect(widgetsFromSettings(settings)).toEqual([
      { options: { showDate: false, showSeconds: false }, type: 'clock' },
      {
        options: { fields: FIELDS, followDevice: false, place: PLACE, unit: 'fahrenheit' },
        type: 'weather',
      },
    ])
  })

  it('gives the Weather alone when the clock is off', () => {
    const settings = withWeather({ enabled: true, place: PLACE }, false)
    expect(widgetsFromSettings(settings).map(({ type }) => type)).toEqual(['weather'])
  })

  it('gives no Weather when the weather is off, whatever else is set', () => {
    const settings = withWeather({ enabled: false, fields: FIELDS, place: PLACE })
    expect(widgetsFromSettings(settings).map(({ type }) => type)).toEqual(['clock'])
  })

  it('lists a Weather that has no place yet, for the Widget to draw nothing', () => {
    const settings = withWeather({ enabled: true, place: null })
    expect(widgetsFromSettings(settings)[1]).toEqual({
      options: {
        fields: DEFAULT_SETTINGS.weather.fields,
        followDevice: false,
        place: null,
        unit: DEFAULT_SETTINGS.weather.unit,
      },
      type: 'weather',
    })
  })

  it('leaves whether the weather is on out of its options', () => {
    const settings = withWeather({ enabled: true, place: PLACE })
    expect(widgetsFromSettings(settings)[1]?.options).not.toHaveProperty('enabled')
  })
})

describe('pageValues', () => {
  it('takes 12/24-hour time from the clock settings', () => {
    expect(pageValues(withClock({ hour12: true }))).toEqual({ hour12: true })
    expect(pageValues(withClock({ hour12: false }))).toEqual({ hour12: false })
  })
})
