import { describe, expect, it } from 'vitest'

import { manifestCache } from '@/photos/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { weatherCache } from './storage'
import { weatherSource } from './useWeather'

const READING = {
  code: 0,
  feelsLike: 3,
  high: 8,
  isDay: true,
  low: 1,
  sunrise: '2026-10-01T07:13',
  sunset: '2026-10-01T18:51',
  temperature: 5,
}

describe('weatherSource', () => {
  it('serves for half an hour, shows stale for three hours and retries after a minute', () => {
    expect(weatherSource.maxAgeMs).toBe(30 * 60 * 1000)
    expect(weatherSource.maxStaleMs).toBe(3 * 60 * 60 * 1000)
    expect(weatherSource.retryMs).toBe(60 * 1000)
  })

  it('keeps one reading, and answers only for the key it was fetched for', async () => {
    await weatherSource.cache.set('here', { data: READING, fetchedAt: 1000 })

    expect(await weatherCache.getValue()).toEqual({ data: READING, fetchedAt: 1000, key: 'here' })
    expect(await weatherSource.cache.get('here')).toEqual({ data: READING, fetchedAt: 1000 })
    expect(await weatherSource.cache.get('there')).toBeNull()
  })

  it('is switched on unless the manifest switches the weather off', async () => {
    expect(await weatherSource.enabled?.()).toBe(true)

    await manifestCache.setValue({
      data: { ...makeManifest([makePhoto('a')]), weather: { enabled: false } },
      etag: null,
      fetchedAt: Date.now(),
    })

    expect(await weatherSource.enabled?.()).toBe(false)
  })
})
