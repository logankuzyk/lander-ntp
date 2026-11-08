import { describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { storedLayout } from './check'
import { deriveLayout } from './derive'
import { knownAt, syncBytes } from './fixtures'

/** Today's defaults, with the unit fixed so that the JSON below is the same in every locale. */
const NEW_INSTALL: Settings = {
  ...DEFAULT_SETTINGS,
  weather: { ...DEFAULT_SETTINGS.weather, unit: 'celsius' },
}

const VICTORIA = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

const withClock = (clock: Partial<Settings['clock']>, base = NEW_INSTALL): Settings => ({
  ...base,
  clock: { ...base.clock, ...clock },
})

const withWeather = (weather: Partial<Settings['weather']>, base = NEW_INSTALL): Settings => ({
  ...base,
  weather: { ...base.weather, ...weather },
})

/** What a first change would store for these settings, as the browser would keep it. */
const stored = (settings: Settings): unknown =>
  JSON.parse(JSON.stringify(storedLayout(deriveLayout(settings))))

/** The same, as an exact JSON value; the order of keys inside it means nothing. */
const json = (text: string): unknown => JSON.parse(text)

const CLOCK = (col: number, w: number, showDate = false, showSeconds = false) =>
  `{"id":"clock000","type":"clock","col":${col},"row":4,"w":${w},"h":2,"options":{"showDate":${showDate},"showSeconds":${showSeconds}}}`

const FIELDS =
  '[{"id":"highLow","shown":true},{"id":"location","shown":false},{"id":"sun","shown":false},{"id":"condition","shown":false},{"id":"feelsLike","shown":false}]'

const WEATHER_OPTIONS = (place: string, followDevice = false) =>
  `{"fields":${FIELDS},"followDevice":${followDevice},"place":${place},"unit":"celsius"}`

const WEATHER = (place: string, followDevice = false) =>
  `{"id":"weather0","type":"weather","col":11,"row":1,"w":2,"h":2,"options":${WEATHER_OPTIONS(place, followDevice)}}`

const CLOCK_WAITING = '{"showDate":false,"showSeconds":false}'

describe('deriveLayout, for a new install', () => {
  it('gives the Clock alone, in the middle, with Weather’s options waiting', () => {
    expect(stored(NEW_INSTALL)).toEqual(
      json(`{"v":1,"widgets":[${CLOCK(5, 4)}],"waiting":{"weather":${WEATHER_OPTIONS('null')}}}`),
    )
  })
})

describe('deriveLayout, for the four ways an update can find the settings (LR-26)', () => {
  it('puts the Clock in the middle and the Weather in the top right, for the Clock and Weather for Victoria', () => {
    const settings = withWeather({ enabled: true, place: VICTORIA })

    expect(stored(settings)).toEqual(
      json(`{"v":1,"widgets":[${CLOCK(5, 4)},${WEATHER(JSON.stringify(VICTORIA))}]}`),
    )
  })

  it('gives the Clock alone, with the Weather’s options waiting, when only the Clock was on', () => {
    const settings = withWeather({ enabled: false, place: VICTORIA })

    expect(stored(settings)).toEqual(
      json(
        `{"v":1,"widgets":[${CLOCK(5, 4)}],"waiting":{"weather":${WEATHER_OPTIONS(JSON.stringify(VICTORIA))}}}`,
      ),
    )
  })

  it('gives no Clock, and a Weather that has no place yet, when the Clock was off and the Weather on', () => {
    const settings = withClock({ enabled: false }, withWeather({ enabled: true }))

    expect(stored(settings)).toEqual(
      json(`{"v":1,"widgets":[${WEATHER('null')}],"waiting":{"clock":${CLOCK_WAITING}}}`),
    )
  })

  it('gives an empty Grid, with both sets of options waiting, when both were off', () => {
    const settings = withClock({ enabled: false })

    expect(stored(settings)).toEqual(
      json(
        `{"v":1,"widgets":[],"waiting":{"clock":${CLOCK_WAITING},"weather":${WEATHER_OPTIONS('null')}}}`,
      ),
    )
  })

  it('is 428 of the 8,192 bytes one synced item may hold for the Clock alone with Weather’s options waiting, as LR-15 measured', () => {
    const settings = withWeather({ enabled: false, place: VICTORIA })

    expect(syncBytes('layout', storedLayout(deriveLayout(settings)))).toBe(428)
  })

  it('keeps the options of the Clock that was switched off, so that adding one starts from them', () => {
    const settings = withClock({ enabled: false, showDate: true, showSeconds: true })

    expect(stored(settings)).toMatchObject({
      waiting: { clock: { showDate: true, showSeconds: true } },
    })
  })
})

describe('deriveLayout, the Clock', () => {
  it('is 4 by 2 at column 5, row 4, so it is exactly in the middle of 12 columns', () => {
    const { placed } = knownAt(deriveLayout(NEW_INSTALL), 0)

    expect(placed).toMatchObject({ col: 5, h: 2, row: 4, w: 4 })
  })

  it('is 6 by 2 at column 4 with seconds, and keeps its date', () => {
    const settings = withClock({ showDate: true, showSeconds: true })

    expect(stored(settings)).toMatchObject({ widgets: [json(CLOCK(4, 6, true, true))] })
  })

  it('does not take the page-wide 12/24-hour value into its options', () => {
    const twelve = deriveLayout(withClock({ hour12: true }))
    const twentyFour = deriveLayout(withClock({ hour12: false }))

    expect(storedLayout(twelve)).toEqual(storedLayout(twentyFour))
    expect(knownAt(twelve, 0).placed.options).toEqual({ showDate: false, showSeconds: false })
  })
})

describe('deriveLayout, the Weather', () => {
  const on = withWeather({ enabled: true, place: VICTORIA })
  const shown = (count: number): Settings['weather']['fields'] =>
    DEFAULT_SETTINGS.weather.fields.map((field, i) => ({ ...field, shown: i < count }))

  it('is 2 by 2 at column 11, row 1, whatever lines it shows (owner answer 1 on LR-19, over LR-16’s 2 by 1)', () => {
    for (const count of [0, 1, 2, 3, 5]) {
      const { placed } = knownAt(deriveLayout(withWeather({ fields: shown(count) }, on)), 1)

      expect(placed).toMatchObject({ col: 11, h: 2, row: 1, w: 2 })
    }
  })

  it('is placed whatever its reading is, with a place, units, lines and the device-following switch', () => {
    const settings = withWeather(
      {
        enabled: true,
        fields: shown(3),
        followDevice: true,
        place: null,
        unit: 'fahrenheit',
      },
      NEW_INSTALL,
    )

    const { placed } = knownAt(deriveLayout(settings), 1)

    expect(placed.options).toEqual({
      fields: shown(3),
      followDevice: true,
      place: null,
      unit: 'fahrenheit',
    })
  })

  it('does not overlap the Clock, with or without seconds', () => {
    const layout = deriveLayout(withClock({ showSeconds: true }, on))

    expect(knownAt(layout, 0).placed).toMatchObject({ col: 4, row: 4, w: 6 })
    expect(knownAt(layout, 1).placed).toMatchObject({ col: 11, row: 1, w: 2 })
  })

  it('gets defaults for settings from before the Weather: they have no weather block', async () => {
    const beforeWeather: Partial<Settings> = { ...NEW_INSTALL }
    delete beforeWeather.weather
    await fakeBrowser.storage.sync.set({ settings: beforeWeather })

    const settings = await settingsItem.getValue()
    const layout = deriveLayout(settings)

    expect(layout.widgets.map((widget) => widget.kind)).toEqual(['known'])
    expect(layout.waiting?.weather).toEqual({
      fields: DEFAULT_SETTINGS.weather.fields,
      followDevice: false,
      place: null,
      unit: DEFAULT_SETTINGS.weather.unit,
    })
  })
})

describe('deriveLayout, in general', () => {
  it('gives the same ids and bytes every time, so two devices derive the same Layout', () => {
    const settings = withWeather({ enabled: true, place: VICTORIA })

    const first = JSON.stringify(storedLayout(deriveLayout(settings)))
    const second = JSON.stringify(storedLayout(deriveLayout({ ...settings })))

    expect(second).toBe(first)
    const ids = knownIds(deriveLayout(settings))
    expect(ids).toEqual(['clock000', 'weather0'])
    expect(ids.every((id) => /^[a-z0-9]{8}$/.test(id))).toBe(true)
  })

  it('draws the Widgets the way a stored Layout of them would be drawn', () => {
    const layout = deriveLayout(withWeather({ enabled: true, place: VICTORIA }))

    expect(layout.widgets.map((widget) => widget.kind)).toEqual(['known', 'known'])
    expect(layout.extra).toEqual({})
  })

  it('does not hand out the settings’ own objects, so a change to the Layout cannot reach them', () => {
    const settings = withWeather({ enabled: true, place: { ...VICTORIA } })
    const before = structuredClone(settings)

    const options = knownAt(deriveLayout(settings), 1).placed.options as {
      fields: { shown: boolean }[]
      place: { name: string }
    }
    options.fields[0]!.shown = false
    options.place.name = 'Elsewhere'

    expect(settings).toEqual(before)
  })
})

function knownIds(layout: ReturnType<typeof deriveLayout>): string[] {
  return layout.widgets.map((_, i) => knownAt(layout, i).placed.id)
}
