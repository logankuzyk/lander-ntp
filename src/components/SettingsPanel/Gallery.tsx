import { useMemo, useState } from 'preact/hooks'

import { Chip } from '@/components/Chip/Chip'
import { buildSrcSet, objectPosition, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'
import { availableTags, filterByTag } from '@/photos/tags'

/** Tiles are about 8rem wide, so the 300px rendition covers them even on a 2x screen. */
const TILE_SIZES = '8rem'

type GalleryProps = {
  photos: readonly Photo[]
  currentId: string | null
  /** The tag the filter starts on: the one being cycled, when there is just one. */
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
  // Thumbnails that failed to load, drawn as empty tiles rather than broken images.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())

  return (
    <section class="gallery" aria-labelledby="gallery-heading">
      <h3 id="gallery-heading">Gallery</h3>

      {tags.length > 0 && (
        <div class="gallery__tags" role="group" aria-label="Filter photos">
          <Chip label="All" pressed={tag === null} onClick={() => setTag(null)} />
          {tags.map(({ slug, name }) => (
            <Chip
              key={slug}
              label={name}
              pressed={tag === slug}
              onClick={() => setTag(tag === slug ? null : slug)}
            />
          ))}
        </div>
      )}

      <ul class="gallery__grid">
        {shown.map((photo) => (
          <li key={photo.id}>
            <button
              type="button"
              class={
                broken.has(photo.id) ? 'gallery__photo gallery__photo--broken' : 'gallery__photo'
              }
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
                onError={() => setBroken((failed) => new Set(failed).add(photo.id))}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
