import type { Onboarding } from '@/onboarding/storage'
import { onboardingItem, pendingItem } from '@/onboarding/storage'
import { manifestCache, photoState } from '@/photos/storage'
import type { Settings } from '@/settings/schema'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { cacheKey, type Weather } from '@/weather/openMeteo'
import { weatherCache } from '@/weather/storage'

import { makeManifest, STORY_PHOTOS } from './fixtures'

export type PageSeed = {
  /** The record synced between devices: what a returning install has. */
  onboarding?: Onboarding
  /** A new install's record, kept on this device until the welcome is answered. */
  pending?: Onboarding
  settings?: Settings
  /** A reading for the place in `settings.weather`, so the Weather shows without asking the forecast. */
  weather?: Weather
}

/** Story photos are served from the page's own origin, but the manifest only allows http(s). */
const absolute = (url: string) => new URL(url, globalThis.location.href).href

/**
 * Fills the (fake) browser storage so `App` draws a given state of the page with nothing to
 * fetch: the photos come from a fresh manifest cache, so `getManifest` serves them and does not
 * revalidate. Stories call it from `beforeEach`; tests call it before rendering.
 */
export async function seedPage({
  onboarding,
  pending,
  settings = DEFAULT_SETTINGS,
  weather,
}: PageSeed = {}) {
  await manifestCache.setValue({
    data: makeManifest(
      STORY_PHOTOS.map((photo) => ({
        ...photo,
        pageUrl: absolute(photo.pageUrl),
        sizes: photo.sizes.map((size) => ({ ...size, url: absolute(size.url) })),
      })),
    ),
    etag: null,
    fetchedAt: Date.now(),
  })
  // The rotation draws from this bag, so the first photo is always the same one, not a random one.
  await photoState.setValue({
    bag: STORY_PHOTOS.map((photo) => photo.id),
    currentId: null,
    shownAt: Date.now(),
  })
  await settingsItem.setValue(settings)
  if (weather) {
    const { place, unit } = settings.weather
    if (!place) throw new Error('seedPage: a weather reading needs settings.weather.place')
    await weatherCache.setValue({
      data: weather,
      fetchedAt: Date.now(),
      key: cacheKey(place, unit),
    })
  }
  if (onboarding) await onboardingItem.setValue(onboarding)
  if (pending) await pendingItem.setValue(pending)
}
