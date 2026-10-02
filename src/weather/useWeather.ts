import { useEffect, useState } from 'preact/hooks'

import type { WeatherSettings } from '@/settings/schema'

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
      }
      timer = setTimeout(() => void update(), MAX_AGE_MS)
    }

    void (async () => {
      last = await devicePosition.getValue()
      if (!active) return
      setPosition(last)
      void update()
    })()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [follow])

  return follow ? position : null
}

/**
 * The weather for the chosen place and that place's name, or null while there is none to show: the widget is off,
 * no place is picked (or the device's can't be had), the manifest has switched the weather off, or nothing is cached and the
 * network is unavailable.
 *
 * Stale-while-revalidate, like the photo manifest: a cached reading for this place and unit is
 * shown straight away and refreshed once older than MAX_AGE_MS, and again each time that
 * passes while the tab stays open. A failed refresh keeps the old reading.
 */
export function useWeather(
  settings: WeatherSettings | null,
): { weather: Weather; place: string } | null {
  const follow = settings?.enabled === true && settings.followDevice
  const position = useDevicePosition(follow)
  const fixed = settings?.enabled ? settings.place : null
  const place = follow
    ? position && { ...position, name: position.name ?? CURRENT_LOCATION }
    : fixed
  const unit = settings?.unit
  const key = place && unit ? cacheKey(place, unit) : null
  const [shown, setShown] = useState<{ key: string; data: Weather } | null>(null)

  useEffect(() => {
    if (!place || !unit || !key) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      const fresh = await fetchWeather(place, unit)
      if (fresh) await weatherCache.setValue({ key, fetchedAt: Date.now(), data: fresh })
      if (!active) return
      if (fresh) setShown({ key, data: fresh })
      timer = setTimeout(() => void refresh(), MAX_AGE_MS)
    }

    void (async () => {
      // Switched off from the manifest: not even the cached reading, which would never refresh.
      const [{ enabled }, cached] = await Promise.all([getEndpoints(), weatherCache.getValue()])
      if (!active || !enabled) return
      if (cached?.key !== key) return refresh()
      setShown({ key, data: cached.data })
      const age = Date.now() - cached.fetchedAt
      timer = setTimeout(() => void refresh(), Math.max(0, MAX_AGE_MS - age))
    })()

    return () => {
      active = false
      clearTimeout(timer)
    }
    // `place` is a new object whenever settings change; `key` says whether it really moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // A reading for the last place is not this place's weather.
  return shown && place && shown.key === key ? { weather: shown.data, place: place.name } : null
}
