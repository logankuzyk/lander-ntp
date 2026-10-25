import { storage } from 'wxt/utils/storage'

import type { Weather } from './openMeteo'

/** A weather reading and when it was fetched. */
export type WeatherReading = {
  data: Weather
  /** Epoch ms of the fetch. */
  fetchedAt: number
}

/**
 * The readings kept between tabs, one for each place and unit that was asked for; see
 * `cacheKey`. Local, not synced: they are this device's, and cheap to fetch again.
 *
 * This is a new key. v0.2.3 kept a single reading under `local:weatherCache`, which nothing
 * reads or writes any more; it costs one fetch, so it is not migrated.
 */
export const weatherReadings = storage.defineItem<Record<string, WeatherReading>>(
  'local:weatherReadings',
  { fallback: {} },
)
