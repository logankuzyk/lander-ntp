import type { Photo } from './schema'
import { poolIds } from './tags'

export type PhotoPool = {
  favouritesGone: boolean
  ids: string[]
  source: 'all' | 'favourites' | 'tags'
}

/** Pick the photos a new draw may use, keeping the tag rules as the fallback. */
export function poolFor({
  favourites,
  favouritesOnly,
  photos,
  tags,
}: {
  favourites: readonly string[]
  favouritesOnly: boolean
  photos: readonly Photo[]
  tags: readonly string[]
}): PhotoPool {
  const isFallback = photos.length === 1 && photos[0]?.id === 'fallback'
  if (favouritesOnly && !isFallback) {
    const favouriteIds = new Set(favourites)
    const ids = photos.filter(({ id }) => favouriteIds.has(id)).map(({ id }) => id)
    if (ids.length > 0) return { favouritesGone: false, ids, source: 'favourites' }
  }

  const ids = poolIds(photos, tags)
  const tagged = new Set(tags)
  const hasTagMatch = photos.some((photo) => photo.tags.some(({ slug }) => tagged.has(slug)))
  return {
    favouritesGone: favouritesOnly && !isFallback,
    ids,
    source: hasTagMatch ? 'tags' : 'all',
  }
}
