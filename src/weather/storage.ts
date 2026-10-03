import { storage } from 'wxt/utils/storage'

import type { Weather } from './openMeteo'

export type WeatherCache = {
  /** The place and unit the reading is for; see `cacheKey`. */
  key: string
  /** Epoch ms of the fetch. */
  fetchedAt: number
  data: Weather
}

export const weatherCache = storage.defineItem<WeatherCache>('local:weatherCache')
