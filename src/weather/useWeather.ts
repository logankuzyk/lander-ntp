import { useEffect, useState } from 'preact/hooks'

import type { WeatherSettings } from '@/settings/schema'

import { locationConsented } from './consent'
import {
  CURRENT_LOCATION,
  devicePosition,
  locate,
  locationAllowed,
  near,
  type DevicePosition,
} from './deviceLocation'
import { getEndpoints } from './endpoints'
import { cacheKey, fetchWeather, type Weather } from './openMeteo'
import { placeName } from './placeName'
import { weatherCache } from './storage'

/**
 * How long a reading is served before asking again. The forecast itself moves every 15
 * minutes; half an hour keeps a day of new tabs to a few dozen requests.
 */
export const MAX_AGE_MS = 30 * 60 * 1000

/**
 * How old a reading can be and still be shown. Past this, with every refresh failing, it is
 * no longer the weather now, and the widget is hidden rather than left saying so.
 */
export const MAX_STALE_MS = 3 * 60 * 60 * 1000

/**
 * Whether a place may be sent anywhere from this device; see weather/consent. Only Firefox
 * has to ask, so everywhere else this is true from the first render.
 */
function useConsent(enabled: boolean): boolean {
  const [consented, setConsented] = useState(import.meta.env.BROWSER !== 'firefox')

  useEffect(() => {
    if (!enabled) return
    let active = true
    void locationConsented().then((allowed) => {
      if (active) setConsented(allowed)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return consented
}

/**
 * Where the device is, while the weather follows it. Starts from the position the last tab
 * left, then asks the browser (and for the name of wherever that is), and again every MAX_AGE_MS while the tab stays open, so the
 * weather moves when the device does. A position near the last one is the same place.
 */
function useDevicePosition(follow: boolean): DevicePosition | null {
  const [position, setPosition] = useState<DevicePosition | null>(null)

  useEffect(() => {
    if (!follow) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let last: DevicePosition | null = null

    const update = async () => {
      const found = (await locationAllowed()) ? await locate() : null
      if (!active) return
      // Somewhere new, or somewhere whose name couldn't be had last time.
      if (found && !(last?.name && near(last, found))) {
        const name = await placeName(found)
        if (!active) return
        // Still the same place for the forecast: only the name is news.
        last = last && near(last, found) ? { ...last, name } : { ...found, name }
        setPosition(last)
        await devicePosition.setValue(last)
        if (!active) return
      }
      timer = setTimeout(() => void update(), MAX_AGE_MS)
    }

    void (async () => {
      last = await devicePosition.getValue()
      if (!active) return
      setPosition(last)
      void update()
    })()

    // "Use my location" in settings writes a position of its own while this is already following.
    const unwatch = devicePosition.watch((next) => {
      if (!next) return
      last = next
      setPosition(next)
    })

    return () => {
      active = false
      clearTimeout(timer)
      unwatch()
    }
  }, [follow])

  return follow ? position : null
}

/**
 * The weather for the chosen place and that place's name, or null while there is none to show: the widget is off,
 * no place is picked (or the device's can't be had), Firefox hasn't been allowed to send one from this device, the manifest
 * has switched the weather off, or nothing recent enough is cached and the network is unavailable.
 *
 * Stale-while-revalidate, like the photo manifest: a cached reading for this place and unit is
 * shown straight away and refreshed once older than MAX_AGE_MS, and again each time that
 * passes while the tab stays open and in view. A failed refresh keeps the old reading until it is older
 * than MAX_STALE_MS.
 */
export function useWeather(
  settings: WeatherSettings | null,
): { weather: Weather; place: string } | null {
  const on = useConsent(settings?.enabled === true) && settings?.enabled === true
  const follow = on && settings.followDevice
  const position = useDevicePosition(follow)
  const fixed = on ? settings.place : null
  const place = follow
    ? position && { ...position, name: position.name ?? CURRENT_LOCATION }
    : fixed
  const unit = settings?.unit
  const key = place && unit ? cacheKey(place, unit) : null
  const [shown, setShown] = useState<{ key: string; fetchedAt: number; data: Weather } | null>(null)

  useEffect(() => {
    if (!place || !unit || !key) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    let checking = false

    /** Check again after a wait; the manifest and the cache are both read anew each time. */
    const again = (wait: number) => {
      timer = setTimeout(() => void check(), wait)
    }

    const check = async () => {
      // Every open tab runs this. One nobody is looking at waits until it is looked at, and the
      // cache is read first, so a reading another tab has just fetched is not fetched again.
      if (checking || document.hidden) return
      checking = true
      clearTimeout(timer)
      try {
        const [{ enabled }, cached] = await Promise.all([getEndpoints(), weatherCache.getValue()])
        if (!active) return
        // Switched off from the manifest: not even the cached reading, which would never refresh.
        if (!enabled) {
          setShown(null)
          return again(MAX_AGE_MS)
        }
        const age = cached?.key === key ? Date.now() - cached.fetchedAt : Infinity
        if (cached && age < MAX_STALE_MS) setShown(cached)
        if (age < MAX_AGE_MS) return again(MAX_AGE_MS - age)

        const fresh = await fetchWeather(place, unit)
        const reading = fresh && { key, fetchedAt: Date.now(), data: fresh }
        if (reading) await weatherCache.setValue(reading)
        if (!active) return
        setShown(
          (old) => reading ?? (old && Date.now() - old.fetchedAt < MAX_STALE_MS ? old : null),
        )
        again(MAX_AGE_MS)
      } finally {
        checking = false
      }
    }

    const onVisibilityChange = () => void check()
    document.addEventListener('visibilitychange', onVisibilityChange)
    void check()

    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // `place` is a new object whenever settings change; `key` says whether it really moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // A reading for the last place is not this place's weather.
  return shown && place && shown.key === key ? { weather: shown.data, place: place.name } : null
}
