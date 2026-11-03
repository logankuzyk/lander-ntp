import { act, render, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { checkLayout, storedLayout } from '@/layout/check'
import { layoutItem } from '@/layout/storage'
import { manifestCache } from '@/photos/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makeManifest, makePhoto, makePlace, makeWeather } from '@/test/fixtures'
import { weatherSource } from '@/weather/weatherSource'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { App } from './App'

const VICTORIA = makePlace()
const VANCOUVER = makePlace({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })
const KEY = {
  kelowna: '49.89,-119.5,celsius',
  vancouver: '49.28,-123.12,celsius',
  victoria: '48.43,-123.37,celsius',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('style')
})

const seedPhotos = () =>
  manifestCache.setValue({
    data: makeManifest([makePhoto('a'), makePhoto('b')]),
    etag: null,
    fetchedAt: Date.now(),
  })

/** Fresh readings, so no Weather on the page asks the forecast for anything. */
const seedReadings = async (...keys: string[]) => {
  for (const key of keys) {
    await weatherSource.cache.set(key, { data: makeWeather(), fetchedAt: Date.now() })
  }
}

const weather = (id: string, col: number, options: Record<string, unknown>) => ({
  col,
  h: 2,
  id,
  options: { ...defaultOptions(weatherDefinition), unit: 'celsius', ...options },
  row: 1,
  type: 'weather',
  w: 2,
})

const at = (...places: (typeof VICTORIA)[]) =>
  places.map((place, index) => weather(`weather${index}`, 1 + index * 2, { place }))

const kept = async () => (await weatherSource.cache.keys()).sort()

/** Long enough for everything that is not held to have arrived, been drawn and been acted on. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)))

/** Holds a stored item's read until `release` is called, then lets it answer as it would. */
const holdRead = <T,>(item: { read: () => Promise<T> }) => {
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  const read = item.read.bind(item)
  vi.spyOn(item, 'read').mockImplementation(async () => {
    await held
    return read()
  })
  return release
}

describe('App, forgetting the readings no Widget uses', () => {
  it('forgets the readings no Weather in the stored Layout uses, once the page has loaded', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: at(VICTORIA, VANCOUVER) } })
    await seedReadings(KEY.victoria, KEY.vancouver, KEY.kelowna)

    render(<App />)

    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria, KEY.vancouver]))
  })

  it('forgets nothing before the stored Layout has been read', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: at(VICTORIA) } })
    await seedReadings(KEY.victoria, KEY.kelowna)
    const release = holdRead(layoutItem)

    render(<App />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])

    release()
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('forgets nothing before the stored settings have been read, when the Layout is worked out from them', async () => {
    await seedPhotos()
    // An updated user: the Weather is in the settings, and no Layout is stored. Worked out from
    // the defaults (no Weather) in the meantime, the Layout would let every reading go.
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: VICTORIA, unit: 'celsius' },
    })
    await seedReadings(KEY.victoria, KEY.kelowna)
    const release = holdRead(settingsItem)

    render(<App />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])

    release()
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('keeps the reading of the Weather an updated user has in the settings, and forgets the rest', async () => {
    await seedPhotos()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: VICTORIA, unit: 'celsius' },
    })
    await seedReadings(KEY.victoria, KEY.vancouver)

    render(<App />)

    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('lets a reading go when the Layout no longer has a Weather using it', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: at(VICTORIA, VANCOUVER) } })
    await seedReadings(KEY.victoria, KEY.vancouver)
    render(<App />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])

    // As when the Layout is changed in another tab, or on another device.
    await layoutItem.setValue(checkLayout({ v: 1, widgets: at(VICTORIA) }))

    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('keeps a reading two Weathers share until both are gone', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 1, widgets: at(VICTORIA, VICTORIA) } })
    await seedReadings(KEY.victoria)
    render(<App />)
    await settle()

    await layoutItem.setValue(checkLayout({ v: 1, widgets: at(VICTORIA) }))
    await settle()
    expect(await kept()).toEqual([KEY.victoria])

    await layoutItem.setValue(checkLayout({ v: 1, widgets: [] }))
    await waitFor(async () => expect(await kept()).toEqual([]))
  })

  it('forgets nothing of a Layout a newer version wrote, which is read-only', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 2, widgets: at(VICTORIA) } })
    await seedReadings(KEY.victoria, KEY.kelowna)

    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])
  })

  it('forgets nothing when the stored settings are from a newer version and no Layout is stored', async () => {
    await seedPhotos()
    // Unreadable as settings, so the page uses the defaults and works out a Layout with no
    // Weather; a newer device may have one, and its readings are not this version's to forget.
    await fakeBrowser.storage.sync.set({ settings: { somethingNew: true, v: 2 } })
    await seedReadings(KEY.victoria, KEY.kelowna)

    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])
  })

  it('forgets nothing while a Weather follows the device and no position has been kept', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({
      layout: { v: 1, widgets: [weather('weather0', 1, { followDevice: true })] },
    })
    await seedReadings(KEY.victoria, KEY.kelowna)

    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])
  })

  it('writes only the readings: nothing to the synced storage, and not the Layout', async () => {
    await seedPhotos()
    const layout = storedLayout(checkLayout({ v: 1, widgets: at(VICTORIA) }))
    await fakeBrowser.storage.sync.set({ layout })
    await seedReadings(KEY.victoria, KEY.kelowna)
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const remove = vi.spyOn(fakeBrowser.storage.sync, 'remove')

    render(<App />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
    await settle()

    expect(set).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(await fakeBrowser.storage.sync.get('layout')).toEqual({ layout })
  })
})
