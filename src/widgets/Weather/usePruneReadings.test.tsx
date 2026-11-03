import { render, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { storage } from 'wxt/utils/storage'

import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'
import { makePlace, makeWeather } from '@/test/fixtures'
import { devicePosition } from '@/weather/deviceLocation'
import { weatherReadings } from '@/weather/storage'
import { weatherSource } from '@/weather/weatherSource'
import { defaultOptions } from '@/widgetSystem/options'

import { weatherDefinition } from './definition'
import { usePruneReadings } from './usePruneReadings'

afterEach(() => vi.unstubAllGlobals())

const VICTORIA = makePlace()
const VANCOUVER = makePlace({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })
const KELOWNA = makePlace({ latitude: 49.89, longitude: -119.5, name: 'Kelowna' })
const KEY = {
  kelowna: '49.89,-119.5,celsius',
  vancouver: '49.28,-123.12,celsius',
  victoria: '48.43,-123.37,celsius',
  victoriaF: '48.43,-123.37,fahrenheit',
}

const weather = (id: string, options: Record<string, unknown>) => ({
  col: 1,
  h: 2,
  id,
  options: { ...defaultOptions(weatherDefinition), unit: 'celsius', ...options },
  row: 1,
  type: 'weather',
  w: 2,
})

/** A Layout of Weathers at these places (or following the device, for `'device'`). */
const layoutAt = (...places: ('device' | typeof VICTORIA)[]): Layout =>
  checkLayout({
    v: 1,
    widgets: places.map((place, index) =>
      weather(`weather${index}`, place === 'device' ? { followDevice: true } : { place }),
    ),
  })

/** Every reading kept, as a Weather asking for these places left it. */
const seed = async (...keys: string[]) => {
  for (const key of keys) {
    await weatherSource.cache.set(key, { data: makeWeather(), fetchedAt: Date.now() })
  }
}

const kept = async () => (await weatherSource.cache.keys()).sort()

type Page = { layout: Layout; loaded?: boolean; readOnly?: boolean }

function Probe({ layout, loaded = true, readOnly = false }: Page) {
  usePruneReadings(layout, { loaded, readOnly })
  return null
}

/** Long enough for storage reads and the prune that follows to have happened. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('usePruneReadings', () => {
  it('forgets the readings no Weather uses once the Layout is loaded', async () => {
    await seed(KEY.victoria, KEY.vancouver, KEY.kelowna)

    render(<Probe layout={layoutAt(VICTORIA)} />)

    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('forgets nothing before the Layout is loaded, and what it should once it is', async () => {
    await seed(KEY.victoria, KEY.vancouver)
    const layout = layoutAt(VICTORIA)

    const { rerender } = render(<Probe layout={layout} loaded={false} />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])

    rerender(<Probe layout={layout} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('forgets nothing from a read-only Layout, which it cannot be sure of', async () => {
    await seed(KEY.victoria, KEY.vancouver)

    render(<Probe layout={layoutAt(VICTORIA)} readOnly />)
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])
  })

  it('lets a reading go when the only Weather using it is removed', async () => {
    await seed(KEY.victoria, KEY.vancouver)
    const { rerender } = render(<Probe layout={layoutAt(VICTORIA, VANCOUVER)} />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])

    rerender(<Probe layout={layoutAt(VICTORIA)} />)

    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('keeps a reading two Weathers share until both are gone', async () => {
    await seed(KEY.victoria, KEY.vancouver)
    const { rerender } = render(<Probe layout={layoutAt(VICTORIA, VICTORIA, VANCOUVER)} />)
    await settle()

    rerender(<Probe layout={layoutAt(VICTORIA, VANCOUVER)} />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])

    rerender(<Probe layout={layoutAt(VANCOUVER)} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.vancouver]))
  })

  it('forgets every reading once the last Weather is removed', async () => {
    await seed(KEY.victoria)
    const { rerender } = render(<Probe layout={layoutAt(VICTORIA)} />)
    await settle()

    rerender(<Probe layout={layoutAt()} />)

    await waitFor(async () => expect(await kept()).toEqual([]))
  })

  it('lets the old reading go when a Weather is given another place or unit', async () => {
    await seed(KEY.victoria, KEY.vancouver)
    const { rerender } = render(<Probe layout={layoutAt(VICTORIA)} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))

    rerender(<Probe layout={layoutAt(VANCOUVER)} />)
    await settle()

    // The Weather has not fetched the new place yet; the old one is no longer wanted.
    expect(await kept()).toEqual([])
  })

  it('keeps the reading of a Weather added, which is wanted before it is fetched', async () => {
    await seed(KEY.victoria, KEY.kelowna)
    const { rerender } = render(<Probe layout={layoutAt(VICTORIA)} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))

    await seed(KEY.kelowna)
    rerender(<Probe layout={layoutAt(VICTORIA, KELOWNA)} />)
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.kelowna])
  })

  it('does nothing while a Weather follows the device and no position has been kept', async () => {
    await seed(KEY.victoria, KEY.vancouver)

    render(<Probe layout={layoutAt(VICTORIA, 'device')} />)
    await settle()

    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])
  })

  it('keeps the reading for the device’s position, and forgets the places it has left', async () => {
    await devicePosition.setValue({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })
    await seed(KEY.victoria, KEY.vancouver)

    render(<Probe layout={layoutAt('device')} />)

    await waitFor(async () => expect(await kept()).toEqual([KEY.vancouver]))
  })

  it('forgets the reading of the place the device has moved from', async () => {
    await devicePosition.setValue({ latitude: 48.43, longitude: -123.37, name: 'Victoria' })
    await seed(KEY.victoria)
    render(<Probe layout={layoutAt('device')} />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria])

    await devicePosition.setValue({ latitude: 49.28, longitude: -123.12, name: 'Vancouver' })

    await waitFor(async () => expect(await kept()).toEqual([]))
  })

  it('waits for the kept position before it forgets, so a following Weather’s reading survives', async () => {
    await devicePosition.setValue({ latitude: 48.43, longitude: -123.37, name: 'Victoria' })
    await seed(KEY.victoria, KEY.vancouver)
    // The position is read, as storage reads are, a beat after the first render.
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const read = devicePosition.getValue.bind(devicePosition)
    vi.spyOn(devicePosition, 'getValue').mockImplementation(async () => {
      await held
      return read()
    })

    render(<Probe layout={layoutAt('device')} />)
    await settle()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])

    release()
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))
  })

  it('writes nothing when there is nothing to forget, and never to the synced storage', async () => {
    await seed(KEY.victoria)
    const writes = vi.fn()
    fakeBrowser.storage.onChanged.addListener(writes)
    const before = await fakeBrowser.storage.local.get()

    render(<Probe layout={layoutAt(VICTORIA)} />)
    await settle()

    expect(writes).not.toHaveBeenCalled()
    expect(await fakeBrowser.storage.local.get()).toEqual(before)
    expect(await fakeBrowser.storage.sync.get()).toEqual({})
  })

  it('writes only the readings, leaving the abandoned v0.2.3 cache and the position alone', async () => {
    await storage.setItem('local:weatherCache', { data: makeWeather(), fetchedAt: 1, key: 'old' })
    await devicePosition.setValue({ latitude: 48.43, longitude: -123.37, name: 'Victoria' })
    await seed(KEY.victoria, KEY.vancouver)
    const others = {
      weatherCache: (await fakeBrowser.storage.local.get('weatherCache')).weatherCache,
      weatherPosition: (await fakeBrowser.storage.local.get('weatherPosition')).weatherPosition,
    }

    render(<Probe layout={layoutAt(VICTORIA)} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))

    const local = await fakeBrowser.storage.local.get()
    expect(local.weatherCache).toEqual(others.weatherCache)
    expect(local.weatherPosition).toEqual(others.weatherPosition)
    expect(await fakeBrowser.storage.sync.get()).toEqual({})
  })

  it('does not ask the browser where the device is', async () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    await devicePosition.setValue({ latitude: 48.43, longitude: -123.37, name: 'Victoria' })
    await seed(KEY.victoria, KEY.vancouver)

    render(<Probe layout={layoutAt('device')} />)
    await waitFor(async () => expect(await kept()).toEqual([KEY.victoria]))

    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('does not fail the page when the readings cannot be changed', async () => {
    await seed(KEY.victoria, KEY.vancouver)
    vi.spyOn(weatherReadings, 'setValue').mockRejectedValue(new Error('quota'))
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    render(<Probe layout={layoutAt(VICTORIA)} />)
    await settle()

    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
    expect(await kept()).toEqual([KEY.victoria, KEY.vancouver])
  })
})
