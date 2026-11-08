import type { Photo, Tag } from './schema'

/** Every tag in use, the most common first. */
export function availableTags(photos: readonly Photo[]): Tag[] {
  const counts = new Map<string, { count: number; tag: Tag }>()
  for (const photo of photos) {
    for (const tag of photo.tags) {
      const entry = counts.get(tag.slug)
      if (entry) entry.count++
      else counts.set(tag.slug, { count: 1, tag })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .map(({ tag }) => tag)
}

/** The photos carrying a tag, or the unflagged photos for null. */
export function filterByTag(photos: readonly Photo[], slug: string | null): readonly Photo[] {
  return slug === null
    ? unflaggedPhotos(photos)
    : photos.filter((photo) => photo.tags.some((tag) => tag.slug === slug))
}

const isFlagged = (photo: Photo) => photo.tags.some((tag) => tag.optIn)
const unflaggedPhotos = (photos: readonly Photo[]) => photos.filter((photo) => !isFlagged(photo))

/**
 * Ids of the photos to cycle: matching any chosen tag, or unflagged photos for All and when
 * no chosen tag matches. If every photo is flagged, keep the pool usable by falling back to all.
 */
export function poolIds(photos: readonly Photo[], slugs: readonly string[]): string[] {
  const wanted = new Set(slugs)
  const tagged = photos.filter((photo) => photo.tags.some(({ slug }) => wanted.has(slug)))
  const ordinary = unflaggedPhotos(photos)
  return (tagged.length > 0 ? tagged : ordinary.length > 0 ? ordinary : photos).map(
    (photo) => photo.id,
  )
}
