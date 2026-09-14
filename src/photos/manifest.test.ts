import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeManifest, makePhoto } from '@/test/fixtures'

import { FETCH_TIMEOUT_MS, getManifest, MANIFEST_URL, MAX_AGE_MS } from './manifest'
import { manifestCache, type ManifestCache } from './storage'

const NOW = Date.parse('2026-09-11T12:00:00Z')
const manifest = makeManifest([makePhoto('a'), makePhoto('b')])
const updated = makeManifest([makePhoto('c')])

const fetchMock = vi.fn<typeof fetch>()

const json = (body: unknown, etag = '"v2"') =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ETag: etag },
  })

const seed = (fetchedAt: number): Promise<void> =>
  manifestCache.setValue({ etag: '"v1"', fetchedAt, data: manifest })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('getManifest', () => {
  it('uses the production endpoint by default', () => {
    expect(MANIFEST_URL).toBe('https://logankuzyk.com/new-tab/photos.json')
  })

  describe('with no cache', () => {
    it('fetches, validates and caches the manifest', async () => {
      fetchMock.mockResolvedValueOnce(json(manifest))

      const result = await getManifest(NOW)

      expect(result).toMatchObject({ source: 'network', manifest })
      expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, {
        headers: {},
        signal: expect.any(AbortSignal),
      })
      expect(await manifestCache.getValue()).toEqual({
        etag: '"v2"',
        fetchedAt: NOW,
        data: manifest,
      })
    })

    it('falls back to the bundled photo when offline', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await getManifest(NOW)

      expect(result.source).toBe('fallback')
      expect(result.manifest.photos).toHaveLength(1)
      expect(result.manifest.photos[0]?.sizes[0]?.url).toMatch(/\/fallback\.webp$/)
      expect(await manifestCache.getValue()).toBeNull()
    })

    it.each([
      ['a newer manifest version', { ...manifest, version: 2 }],
      ['a photo without sizes', makeManifest([makePhoto('a', { sizes: [] })])],
      ['a javascript: link', makeManifest([makePhoto('a', { pageUrl: 'javascript:alert(1)' })])],
      [
        'a non-http image',
        makeManifest([makePhoto('a', { sizes: [{ url: 'data:x', width: 1 }] })]),
      ],
      // focalX/focalY go straight into `object-position`.
      ['an out-of-range focal point', makeManifest([makePhoto('a', { focalX: 150 })])],
    ])('rejects %s', async (_, body) => {
      fetchMock.mockResolvedValueOnce(json(body))

      expect((await getManifest(NOW)).source).toBe('fallback')
      expect(await manifestCache.getValue()).toBeNull()
    })

    it('falls back when the manifest has no photos', async () => {
      fetchMock.mockResolvedValueOnce(json(makeManifest([])))

      expect((await getManifest(NOW)).manifest.photos[0]?.id).toBe('fallback')
    })

    it('sorts sizes ascending', async () => {
      const [small, large] = makePhoto('a').sizes
      fetchMock.mockResolvedValueOnce(
        json(makeManifest([makePhoto('a', { sizes: [large!, small!] })])),
      )

      const { manifest: result } = await getManifest(NOW)

      expect(result.photos[0]?.sizes.map((size) => size.width)).toEqual([300, 1920])
    })
  })

  describe('with a cache', () => {
    it('serves a fresh cache without fetching', async () => {
      await seed(NOW - MAX_AGE_MS + 1)

      const result = await getManifest(NOW)
      await result.revalidation

      expect(result).toMatchObject({ source: 'cache', manifest })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('serves a stale cache straight away and revalidates with If-None-Match', async () => {
      await seed(NOW - MAX_AGE_MS)
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }))

      const result = await getManifest(NOW)
      expect(result).toMatchObject({ source: 'cache', manifest })
      await result.revalidation

      expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, {
        headers: { 'If-None-Match': '"v1"' },
        signal: expect.any(AbortSignal),
      })
      expect(await manifestCache.getValue()).toEqual({
        etag: '"v1"',
        fetchedAt: NOW,
        data: manifest,
      })
    })

    it('stores a changed manifest for the next visit', async () => {
      await seed(NOW - MAX_AGE_MS)
      fetchMock.mockResolvedValueOnce(json(updated, '"v3"'))

      const result = await getManifest(NOW)
      await result.revalidation

      expect(result.manifest).toEqual(manifest)
      expect(await manifestCache.getValue()).toEqual({
        etag: '"v3"',
        fetchedAt: NOW,
        data: updated,
      })
    })

    it.each([
      ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['a server error', () => Promise.resolve(new Response('oops', { status: 500 }))],
      ['invalid data', () => Promise.resolve(json({ version: 1, photos: 'nope' }))],
    ])('keeps the stale cache after %s', async (_, respond) => {
      const fetchedAt = NOW - MAX_AGE_MS
      await seed(fetchedAt)
      fetchMock.mockImplementationOnce(respond)

      const result = await getManifest(NOW)
      await result.revalidation

      expect(result.manifest).toEqual(manifest)
      expect(await manifestCache.getValue()).toEqual({ etag: '"v1"', fetchedAt, data: manifest })
    })

    it('ignores a cache that no longer matches the schema', async () => {
      await manifestCache.setValue({
        etag: '"old"',
        fetchedAt: NOW,
        data: { version: 0 },
      } as unknown as ManifestCache)
      fetchMock.mockResolvedValueOnce(json(manifest))

      const result = await getManifest(NOW)

      expect(result.source).toBe('network')
      expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, {
        headers: {},
        signal: expect.any(AbortSignal),
      })
    })
  })

  it('gives up on a hanging network and falls back', async () => {
    // Without the timeout this never settles and the page renders no background at all.
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
        }),
    )

    try {
      const pending = getManifest(NOW)
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1)
      const result = await pending

      expect(result.source).toBe('fallback')
      expect(result.manifest.photos).toHaveLength(1)
      expect(await manifestCache.getValue()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
