import { useEffect, useState } from 'preact/hooks'

import type { WeatherSettings } from '@/settings/schema'

import { getEndpoints } from './endpoints'
import { cacheKey, fetchWeather, type Weather } from './openMeteo'
import { weatherCache } from './storage'

/**
 * How long a reading is served before asking again. The forecast itself moves every 15
 * minutes; half an hour keeps a day of new tabs to a few dozen requests.
 */
export const MAX_AGE_MS = 30 * 60 * 1000

/**
 * The weather for the chosen place, or null while there is none to show: the widget is off,
 * no place is picked, the manifest has switched the weather off, or nothing is cached and the
 * network is unavailable.
 *
 * Stale-while-revalidate, like the photo manifest: a cached reading for this place and unit is
 * shown straight away and refreshed once older than MAX_AGE_MS, and again each time that
 * passes while the tab stays open. A failed refresh keeps the old reading.
 */
export function useWeather(settings: WeatherSettings | null): Weather | null {
  const place = settings?.enabled ? settings.place : null
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
  return shown && shown.key === key ? shown.data : null
}
