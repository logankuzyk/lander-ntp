import { useMemo, useState } from 'preact/hooks'

import { Chip } from '@/components/Chip/Chip'
import { buildSrcSet, objectPosition, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'
import { availableTags, filterByTag } from '@/photos/tags'

/** Tiles are about 8rem wide, so the 300px rendition covers them even on a 2x screen. */
const TILE_SIZES = '8rem'

type GalleryProps = {
  currentId: string | null
  /** The tag the filter starts on: the one being cycled, when there is just one. */
  initialTag: string | null
  onSelect: (id: string) => void
  photos: readonly Photo[]
}

const photoLabel = (photo: Photo, index: number) =>
  photo.alt ?? photo.location ?? `Photo ${index + 1}`

/**
 * Every photo, to pick the background by hand. The tags only filter what is shown here; which
 * photos get cycled is set above it.
 */
export function Gallery({ currentId, initialTag, onSelect, photos }: GalleryProps) {
  const tags = useMemo(() => availableTags(photos), [photos])
  const [tag, setTag] = useState<string | null>(() =>
    tags.some(({ slug }) => slug === initialTag) ? initialTag : null,
  )
  const shown = useMemo(() => filterByTag(photos, tag), [photos, tag])
  // Thumbnails that failed to load, drawn as empty tiles rather than broken images.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())

  return (
    <section aria-labelledby="gallery-heading" class="gallery">
      <h3 id="gallery-heading">Gallery</h3>

      {tags.length > 0 && (
        <div aria-label="Filter photos" class="gallery__tags" role="group">
          <Chip label="All" onClick={() => setTag(null)} pressed={tag === null} />
          {tags.map(({ name, slug }) => (
            <Chip
              key={slug}
              label={name}
              onClick={() => setTag(tag === slug ? null : slug)}
              pressed={tag === slug}
            />
          ))}
        </div>
      )}

      <ul class="gallery__grid">
        {shown.map((photo) => (
          <li key={photo.id}>
            <button
              aria-current={photo.id === currentId ? 'true' : undefined}
              class={
                broken.has(photo.id) ? 'gallery__photo gallery__photo--broken' : 'gallery__photo'
              }
              onClick={() => onSelect(photo.id)}
              type="button"
            >
              <img
                alt={photoLabel(photo, photos.indexOf(photo))}
                decoding="async"
                loading="lazy"
                onError={() => setBroken((failed) => new Set(failed).add(photo.id))}
                sizes={TILE_SIZES}
                src={thumbnailUrl(photo)}
                srcset={buildSrcSet(photo.sizes)}
                style={{ objectPosition: objectPosition(photo) }}
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
