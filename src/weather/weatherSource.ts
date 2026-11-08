import type { Reading, ReadingCache, Source } from '@/widgetSystem/source'

import { getEndpoints } from './endpoints'
import type { Weather } from './openMeteo'
import { weatherReadings } from './storage'

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

/** What the weather's cache can do beyond any other: say what it holds, and forget some of it. */
export type WeatherReadingCache = Required<ReadingCache<Weather>> & {
  /** The keys that have a reading kept. */
  keys: () => Promise<string[]>
  /** Forgets every reading whose key is not in `keep`. */
  prune: (keep: readonly string[]) => Promise<void>
}

/**
 * Changes to the record are made one after another. Each is a read then a write of the whole
 * record, so two at once, such as two Weathers finishing together, would lose one.
 * (Another tab can still do that to this one; the reading lost is fetched again.)
 */
let changing: Promise<unknown> = Promise.resolve()
function change(edit: (readings: Record<string, Reading<Weather>>) => boolean): Promise<void> {
  const done = changing.then(async () => {
    const readings = { ...(await weatherReadings.getValue()) }
    if (edit(readings)) await weatherReadings.setValue(readings)
  })
  changing = done.catch(() => undefined)
  return done
}

const readingFor = (readings: Record<string, Reading<Weather>> | null, key: string) =>
  readings && Object.hasOwn(readings, key) ? readings[key]! : null

/** One reading for each key, in a single record in local storage. */
const cache: WeatherReadingCache = {
  get: async (key) => readingFor(await weatherReadings.getValue(), key),
  keys: async () => Object.keys(await weatherReadings.getValue()),
  prune: (keep) =>
    change((readings) => {
      const forgotten = Object.keys(readings).filter((key) => !keep.includes(key))
      for (const key of forgotten) delete readings[key]
      return forgotten.length > 0
    }),
  set: (key, { data, fetchedAt }) =>
    change((readings) => {
      readings[key] = { data, fetchedAt }
      return true
    }),
  watch: (key, onChange) =>
    weatherReadings.watch((next, previous) => {
      const reading = readingFor(next, key)
      const before = readingFor(previous, key)
      if (reading?.fetchedAt !== before?.fetchedAt) onChange(reading)
    }),
}

/** Where the weather comes from; the manifest can switch it off. */
export const weatherSource: Source<Weather> & { cache: WeatherReadingCache } = {
  cache,
  enabled: async () => (await getEndpoints()).enabled,
  maxAgeMs: MAX_AGE_MS,
  maxStaleMs: MAX_STALE_MS,
  retryMs: RETRY_MS,
}
