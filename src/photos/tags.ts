import type { Photo } from './schema'

export type Tag = { slug: string; name: string }

/** The website's catch-all collection. Every photo could be in it, so it filters nothing. */
const CATCH_ALL = 'all'

const titleCase = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')

/**
 * The manifest has no tags yet, so a photo's tag is the website collection its `pageUrl` opens
 * it in (`/photography/japan?photo=…` → Japan). Photos that only link to the photography index,
 * or to the catch-all collection, have none.
 */
export function photoTag(photo: Photo): Tag | null {
  let url: URL
  try {
    url = new URL(photo.pageUrl)
  } catch {
    return null
  }
  if (!url.searchParams.has('photo')) return null

  const segment = url.pathname.split('/').filter(Boolean).pop()
  if (!segment) return null
  let slug: string
  try {
    slug = decodeURIComponent(segment).toLowerCase()
  } catch {
    return null
  }
  if (slug === CATCH_ALL) return null

  const name = titleCase(slug)
  return name ? { slug, name } : null
}

/** Every tag in use, the most common first. */
export function availableTags(photos: readonly Photo[]): Tag[] {
  const counts = new Map<string, { tag: Tag; count: number }>()
  for (const photo of photos) {
    const tag = photoTag(photo)
    if (!tag) continue
    const entry = counts.get(tag.slug)
    if (entry) entry.count++
    else counts.set(tag.slug, { tag, count: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.name.localeCompare(b.tag.name))
    .map(({ tag }) => tag)
}

/** The photos carrying a tag, or all of them for null. */
export function filterByTag(photos: readonly Photo[], slug: string | null): readonly Photo[] {
  return slug === null ? photos : photos.filter((photo) => photoTag(photo)?.slug === slug)
}
