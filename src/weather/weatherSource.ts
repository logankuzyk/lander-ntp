import type { Source } from '@/widgetSystem/source'

import { getEndpoints } from './endpoints'
import type { Weather } from './openMeteo'
import { weatherCache } from './storage'

/**
 * How long a reading is served before asking again. The forecast itself moves every 15
 * minutes; half an hour keeps a day of new tabs to a few dozen requests.
 */
export const MAX_AGE_MS = 30 * 60 * 1000

/**
 * How old a reading can be and still be shown. Past this, with every refresh failing, it is
 * no longer the weather now, and the widget is hidden rather than left saying so.
 */
export const MAX_STALE_MS = 3 * 60 * 60 * 1000

/** How soon to ask again after a refresh that failed, which may only mean the network was away. */
export const RETRY_MS = 60 * 1000

/**
 * Where the weather comes from. `weatherCache` holds a single reading, so it answers only for the
 * key it was fetched for; the manifest can switch the weather off.
 */
export const weatherSource: Source<Weather> = {
  cache: {
    get: async (key) => {
      const cached = await weatherCache.getValue()
      return cached?.key === key ? { data: cached.data, fetchedAt: cached.fetchedAt } : null
    },
    set: (key, { data, fetchedAt }) => weatherCache.setValue({ data, fetchedAt, key }),
  },
  enabled: async () => (await getEndpoints()).enabled,
  maxAgeMs: MAX_AGE_MS,
  maxStaleMs: MAX_STALE_MS,
  retryMs: RETRY_MS,
}
