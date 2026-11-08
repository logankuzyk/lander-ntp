import { describe, expect, it, vi } from 'vitest'
import { storage } from 'wxt/utils/storage'

import { manifestCache } from '@/photos/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'
import type { Reading } from '@/widgetSystem/source'

import type { Weather } from './openMeteo'
import { weatherReadings } from './storage'
import { weatherSource } from './weatherSource'

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

  it('keeps a reading for each key, in one record', async () => {
    const other = { data: { ...READING, temperature: 9 }, fetchedAt: 2000 }
    await weatherSource.cache.set('here', { data: READING, fetchedAt: 1000 })
    await weatherSource.cache.set('there', other)

    expect(await weatherReadings.getValue()).toEqual({
      here: { data: READING, fetchedAt: 1000 },
      there: other,
    })
    expect(await weatherSource.cache.get('here')).toEqual({ data: READING, fetchedAt: 1000 })
    expect(await weatherSource.cache.get('there')).toEqual(other)
    expect(await weatherSource.cache.get('nowhere')).toBeNull()
  })

  it('replaces the reading for a key, leaving the others', async () => {
    await weatherSource.cache.set('here', { data: READING, fetchedAt: 1000 })
    await weatherSource.cache.set('there', { data: READING, fetchedAt: 1000 })

    await weatherSource.cache.set('here', { data: { ...READING, temperature: 9 }, fetchedAt: 2000 })

    expect(await weatherSource.cache.get('here')).toMatchObject({ fetchedAt: 2000 })
    expect(await weatherSource.cache.get('there')).toMatchObject({ fetchedAt: 1000 })
  })

  it('keeps every reading when several are set at once', async () => {
    await Promise.all(
      ['a', 'b', 'c'].map((key, index) =>
        weatherSource.cache.set(key, { data: READING, fetchedAt: index }),
      ),
    )

    expect(await weatherSource.cache.keys()).toEqual(['a', 'b', 'c'])
  })

  it('does not read, or touch, the single reading that v0.2.3 kept', async () => {
    const old = { data: READING, fetchedAt: Date.now(), key: 'here' }
    await storage.setItem('local:weatherCache', old)

    expect(await weatherSource.cache.get('here')).toBeNull()
    expect(await weatherSource.cache.keys()).toEqual([])
    await weatherSource.cache.set('there', { data: READING, fetchedAt: 1000 })

    expect(await storage.getItem('local:weatherCache')).toEqual(old)
  })

  it('lists its keys, none when nothing is kept', async () => {
    expect(await weatherSource.cache.keys()).toEqual([])

    await weatherSource.cache.set('here', { data: READING, fetchedAt: 1000 })
    await weatherSource.cache.set('there', { data: READING, fetchedAt: 1000 })

    expect(await weatherSource.cache.keys()).toEqual(['here', 'there'])
  })

  it('forgets every reading but those to keep', async () => {
    for (const key of ['a', 'b', 'c']) {
      await weatherSource.cache.set(key, { data: READING, fetchedAt: 1000 })
    }

    await weatherSource.cache.prune(['a', 'c', 'not kept yet'])

    expect(await weatherSource.cache.keys()).toEqual(['a', 'c'])
    expect(await weatherSource.cache.get('b')).toBeNull()
  })

  it('forgets everything when told to keep nothing', async () => {
    await weatherSource.cache.set('a', { data: READING, fetchedAt: 1000 })

    await weatherSource.cache.prune([])

    expect(await weatherSource.cache.keys()).toEqual([])
  })

  it('keeps saving after one save fails', async () => {
    vi.spyOn(weatherReadings, 'setValue').mockRejectedValueOnce(new Error('storage is full'))

    await expect(
      weatherSource.cache.set('here', { data: READING, fetchedAt: 1000 }),
    ).rejects.toThrow('storage is full')
    await weatherSource.cache.set('there', { data: READING, fetchedAt: 2000 })

    expect(await weatherSource.cache.keys()).toEqual(['there'])
    vi.restoreAllMocks()
  })

  it('tells a watcher of one key when that key’s reading changes, and of no other', async () => {
    const seen: (Reading<Weather> | null)[] = []
    const unwatch = weatherSource.cache.watch('here', (reading) => seen.push(reading))

    await weatherSource.cache.set('there', { data: READING, fetchedAt: 1000 })
    await weatherSource.cache.set('here', { data: READING, fetchedAt: 2000 })
    await weatherSource.cache.prune([])
    unwatch()
    await weatherSource.cache.set('here', { data: READING, fetchedAt: 3000 })

    expect(seen).toEqual([{ data: READING, fetchedAt: 2000 }, null])
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
