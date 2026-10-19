import { useEffect, useState } from 'preact/hooks'

import {
  devicePosition,
  type DevicePosition,
  locate,
  locationAllowed,
  near,
} from './deviceLocation'
import { placeName } from './placeName'
import { MAX_AGE_MS } from './weatherSource'

/**
 * Where the device is, while the weather follows it. Starts from the position the last tab
 * left, then asks the browser (and for the name of wherever that is), and again every MAX_AGE_MS while the tab stays open, so the
 * weather moves when the device does. A position near the last one is the same place.
 */
export function useDevicePosition(follow: boolean): DevicePosition | null {
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

    // "Current location" in settings writes a position of its own while this is already following.
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
