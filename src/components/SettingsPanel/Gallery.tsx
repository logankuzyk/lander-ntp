import { useMemo, useState } from 'preact/hooks'

import { buildSrcSet, objectPosition, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'
import { availableTags, filterByTag } from '@/photos/tags'

/** Tiles are about 8rem wide, so the 300px rendition covers them even on a 2x screen. */
const TILE_SIZES = '8rem'

type GalleryProps = {
  photos: readonly Photo[]
  currentId: string | null
  /** The tag being cycled, which the filter starts on. */
  initialTag: string | null
  onSelect: (id: string) => void
}

const photoLabel = (photo: Photo, index: number) =>
  photo.alt ?? photo.location ?? `Photo ${index + 1}`

/**
 * Every photo, to pick the background by hand. The tags only filter what is shown here; which
 * photos get cycled is set above it.
 */
export function Gallery({ photos, currentId, initialTag, onSelect }: GalleryProps) {
  const tags = useMemo(() => availableTags(photos), [photos])
  const [tag, setTag] = useState<string | null>(() =>
    tags.some(({ slug }) => slug === initialTag) ? initialTag : null,
  )
  const shown = useMemo(() => filterByTag(photos, tag), [photos, tag])

  return (
    <section class="gallery" aria-labelledby="gallery-heading">
      <h3 id="gallery-heading">Gallery</h3>

      {tags.length > 0 && (
        <div class="gallery__tags" role="group" aria-label="Filter photos">
          <button
            type="button"
            class="chip"
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            All
          </button>
          {tags.map(({ slug, name }) => (
            <button
              key={slug}
              type="button"
              class="chip"
              aria-pressed={tag === slug}
              onClick={() => setTag(tag === slug ? null : slug)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ul class="gallery__grid">
        {shown.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              class="gallery__photo"
              aria-current={photo.id === currentId ? 'true' : undefined}
              onClick={() => onSelect(photo.id)}
            >
              <img
                src={thumbnailUrl(photo)}
                srcset={buildSrcSet(photo.sizes)}
                sizes={TILE_SIZES}
                alt={photoLabel(photo, photos.indexOf(photo))}
                loading="lazy"
                decoding="async"
                style={{ objectPosition: objectPosition(photo) }}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
