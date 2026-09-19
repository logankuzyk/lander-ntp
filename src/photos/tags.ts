import type { Photo, Tag } from './schema'

/** Every tag in use, the most common first. */
export function availableTags(photos: readonly Photo[]): Tag[] {
  const counts = new Map<string, { tag: Tag; count: number }>()
  for (const photo of photos) {
    for (const tag of photo.tags) {
      const entry = counts.get(tag.slug)
      if (entry) entry.count++
      else counts.set(tag.slug, { tag, count: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .map(({ tag }) => tag)
}

/** The photos carrying a tag, or all of them for null. */
export function filterByTag(photos: readonly Photo[], slug: string | null): readonly Photo[] {
  return slug === null
    ? photos
    : photos.filter((photo) => photo.tags.some((tag) => tag.slug === slug))
}
