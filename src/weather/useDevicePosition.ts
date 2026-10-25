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

type Listener = (position: DevicePosition | null) => void

/** The Weathers in this tab that follow the device. */
const listeners = new Set<Listener>()
/** Where the device is, as far as the tab knows; null until it has been found. */
let current: DevicePosition | null = null
/** Ends the tab's one following of the device, while any Weather is following it. */
let stopFollowing: (() => void) | null = null

function publish(position: DevicePosition | null) {
  current = position
  for (const listener of listeners) listener(position)
}

/**
 * Starts following the device for the whole tab: starts from the position the last tab left,
 * then asks the browser (and for the name of wherever that is), and again every MAX_AGE_MS. A
 * position near the last one is the same place.
 */
function startFollowing(): () => void {
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
      publish(last)
      await devicePosition.setValue(last)
      if (!active) return
    }
    timer = setTimeout(() => void update(), MAX_AGE_MS)
  }

  void (async () => {
    last = await devicePosition.getValue()
    if (!active) return
    publish(last)
    void update()
  })()

  // "Current location" in settings writes a position of its own while this is already following.
  const unwatch = devicePosition.watch((next) => {
    if (!next) return
    last = next
    publish(next)
  })

  return () => {
    active = false
    clearTimeout(timer)
    unwatch()
  }
}

/** Follows the device for as long as anything is listening, once however many are. */
function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) stopFollowing = startFollowing()
  else listener(current)

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    stopFollowing?.()
    stopFollowing = null
    current = null
  }
}

/**
 * Where the device is, while the weather follows it. It is found once for the tab, however many
 * Weathers follow the device, rather than each asking the browser and for the name of the town:
 * the first to follow starts it and the last to stop ends it. See `startFollowing`.
 */
export function useDevicePosition(follow: boolean): DevicePosition | null {
  const [position, setPosition] = useState<DevicePosition | null>(null)

  useEffect(() => {
    if (!follow) return
    return subscribe(setPosition)
  }, [follow])

  return follow ? position : null
}
