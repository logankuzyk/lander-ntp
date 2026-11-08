import type { Layout } from '@/layout/types'
import type { DevicePosition } from '@/weather/deviceLocation'
import { cacheKey } from '@/weather/openMeteo'

import { weatherDefinition, type WeatherOptions } from './definition'

/**
 * The keys of the readings the Layout's Weathers use: the ones `cacheKey` gives for the place
 * each shows, in its unit, or, for one that follows the device, for `position`. Each key once.
 * Null when that cannot be told yet: a Weather follows the device and its position is not known
 * (`position` is null), so the key it will ask for is not either.
 *
 * Every Weather in the Layout counts, drawn or not: one the Grid has no room for stays in the
 * Layout and is drawn again once there is. Options kept waiting for the first Weather added do
 * not, as nothing asks for a reading with them, nor do Widgets of other types or ones that
 * cannot be placed. A Weather is read as it is drawn, so options that fail their check count as
 * its defaults. Pure: it only reads.
 */
export function weatherReadingsInUse(
  layout: Layout,
  position: DevicePosition | null,
): string[] | null {
  const keys = new Set<string>()
  for (const widget of layout.widgets) {
    if (widget.kind !== 'known' || widget.definition.type !== weatherDefinition.type) continue
    const { followDevice, place, unit } = widget.options as WeatherOptions
    if (followDevice) {
      if (!position) return null
      keys.add(cacheKey({ ...position, name: position.name ?? '' }, unit))
    } else if (place) {
      keys.add(cacheKey(place, unit))
    }
  }
  return [...keys]
}
