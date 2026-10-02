import * as v from 'valibot'

import type { Coordinates } from './deviceLocation'
import { getEndpoints } from './endpoints'
import { getJson } from './openMeteo'

const PlaceNameSchema = v.object({
  city: v.optional(v.string()),
  locality: v.optional(v.string()),
  principalSubdivision: v.optional(v.string()),
})

/**
 * The name of the town at a position, for a place that came from the device rather than the
 * search. Open-Meteo can't answer this, so it comes from BigDataCloud's client-side reverse
 * geocoder: no key, and free on the condition that it is only asked about where this device
 * is right now. So call it with a position `locate` has just returned, never a stored one.
 * Null when it can't be had; the widget then says "Current location".
 */
export async function placeName(position: Coordinates): Promise<string | null> {
  const { enabled, placeNameUrl } = await getEndpoints()
  if (!enabled) return null
  const found = await getJson(
    placeNameUrl,
    {
      latitude: String(position.latitude),
      localityLanguage: navigator.language.split('-')[0] ?? 'en',
      longitude: String(position.longitude),
    },
    PlaceNameSchema,
  )
  return found?.city || found?.locality || found?.principalSubdivision || null
}
