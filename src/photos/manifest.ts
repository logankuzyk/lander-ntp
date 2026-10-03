import * as v from 'valibot'
import { browser } from 'wxt/browser'

import { type Manifest, ManifestSchema } from './schema'
import { manifestCache, type ManifestCache } from './storage'

export const MANIFEST_URL =
  import.meta.env.WXT_PHOTO_MANIFEST_URL || 'https://logankuzyk.com/new-tab/photos.json'

/** Serve the cache for this long before revalidating in the background. */
export const MAX_AGE_MS = 6 * 60 * 60 * 1000

/**
 * Give up on the network after this long. A first run behind a captive portal or a stalled
 * connection would otherwise hang forever, leaving the page with no background at all.
 */
export const FETCH_TIMEOUT_MS = 5000

/** Shown when there is no usable cache and the network is unavailable. */
export function fallbackManifest(): Manifest {
  return {
    generatedAt: new Date(0).toISOString(),
    photos: [
      {
        alt: null,
        exif: {},
        focalX: null,
        focalY: null,
        height: 1280,
        id: 'fallback',
        location: null,
        pageUrl: 'https://logankuzyk.com/photography',
        printUrl: null,
        sizes: [{ url: browser.runtime.getURL('/fallback.webp'), width: 1920 }],
        tags: [],
        width: 1920,
      },
    ],
    version: 1,
  }
}

/**
 * Fetch the manifest, sending If-None-Match when there is a cache. Updates the cache on a
 * valid 200 or a 304 and returns it; returns null (leaving the cache alone) on network
 * errors, timeouts, bad statuses and invalid data.
 */
export async function revalidateManifest(
  cached: ManifestCache | null,
  now: number,
): Promise<ManifestCache | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(MANIFEST_URL, {
      headers: cached?.etag ? { 'If-None-Match': cached.etag } : {},
      signal: controller.signal,
    })

    if (response.status === 304 && cached) {
      const next = { ...cached, fetchedAt: now }
      await manifestCache.setValue(next)
      return next
    }
    if (!response.ok) return null

    const result = v.safeParse(ManifestSchema, await response.json())
    if (!result.success) return null

    const next = { data: result.output, etag: response.headers.get('ETag'), fetchedAt: now }
    await manifestCache.setValue(next)
    return next
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export type ManifestResult = {
  manifest: Manifest
  /** Settles once any background revalidation has finished. */
  revalidation: Promise<void>
  source: 'cache' | 'fallback' | 'network'
}

const usable = (manifest: Manifest) => (manifest.photos.length > 0 ? manifest : fallbackManifest())

/**
 * Stale-while-revalidate: a cached manifest is returned straight away (refreshed in the
 * background once older than MAX_AGE_MS). With no cache, wait for the network, falling back
 * to the bundled photo.
 */
export async function getManifest(now = Date.now()): Promise<ManifestResult> {
  const stored = await manifestCache.getValue()
  // A cache written by an older version may no longer match the schema, or may predate a field
  // that has a default. Parsing fills those in.
  const parsed = stored && v.safeParse(ManifestSchema, stored.data)
  const cached = stored && parsed?.success ? { ...stored, data: parsed.output } : null

  if (cached) {
    const stale = now - cached.fetchedAt >= MAX_AGE_MS
    return {
      manifest: usable(cached.data),
      revalidation: stale
        ? revalidateManifest(cached, now).then(() => undefined)
        : Promise.resolve(),
      source: 'cache',
    }
  }

  const fresh = await revalidateManifest(null, now)
  return {
    manifest: usable(fresh?.data ?? fallbackManifest()),
    revalidation: Promise.resolve(),
    source: fresh ? 'network' : 'fallback',
  }
}
