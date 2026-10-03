import { storage } from 'wxt/utils/storage'

import type { Weather } from './openMeteo'

export type WeatherCache = {
  data: Weather
  /** Epoch ms of the fetch. */
  fetchedAt: number
  /** The place and unit the reading is for; see `cacheKey`. */
  key: string
}

export const weatherCache = storage.defineItem<WeatherCache>('local:weatherCache')
