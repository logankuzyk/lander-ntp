import { useEffect, useState } from 'preact/hooks'

import type { Layout } from '@/layout/types'
import { type DevicePosition, devicePosition } from '@/weather/deviceLocation'
import { weatherSource } from '@/weather/weatherSource'

import { weatherReadingsInUse } from './readingsInUse'

/**
 * Where the device was last kept, for a Weather that follows it; null until that has been read,
 * and when none has been kept. Only read: it never asks the browser where the device is (that
 * is for a Weather whose needs are met: see `useDevicePosition`).
 */
function useKeptPosition(): DevicePosition | null {
  const [position, setPosition] = useState<DevicePosition | null>(null)
  useEffect(() => {
    let active = true
    // A change can land before the first read resolves; the read is older, so it loses.
    let changed = false
    void devicePosition
      .getValue()
      .then((kept) => {
        if (active && !changed) setPosition(kept)
      })
      // Unreadable: the position stays unknown, and nothing following the device is forgotten.
      .catch(() => undefined)
    const unwatch = devicePosition.watch((next) => {
      changed = true
      setPosition(next)
    })
    return () => {
      active = false
      unwatch()
    }
  }, [])
  return position
}

/**
 * Forgets the weather readings no Weather in the Layout uses (see `weatherReadingsInUse`): once
 * the Layout is loaded, and again whenever the readings in use change, which is when a Weather
 * is added or removed, is given another place or unit, or a device it follows moves. Removing a
 * Weather lets its readings go. It writes `local:weatherReadings` and nothing else, only when
 * there is something to forget, and nothing to `sync:*`.
 *
 * It does nothing until the Layout can be trusted, and what that is lies with the caller:
 * `loaded` is true once the stored settings and the stored Layout have both arrived (before
 * that the Layout is worked out from the defaults, which has no Weather), and `readOnly` is true
 * for a Layout a newer version wrote, which this one cannot be sure it reads whole. It also
 * waits for the kept position while a Weather follows the device (`weatherReadingsInUse` is
 * unsure until it has one). A failure to forget is let be: the readings stay until the next
 * time.
 */
export function usePruneReadings(
  layout: Layout,
  { loaded, readOnly }: { loaded: boolean; readOnly: boolean },
): void {
  const position = useKeptPosition()
  const keep = loaded && !readOnly ? weatherReadingsInUse(layout, position) : null
  // A string, so that a Layout that changes without changing the keys prunes nothing again.
  const signature = keep && JSON.stringify([...keep].sort())

  useEffect(() => {
    if (signature === null) return
    weatherSource.cache.prune(JSON.parse(signature) as string[]).catch(() => undefined)
  }, [signature])
}
