import { useMemo, useState } from 'preact/hooks'

import { isFavourite, presentFavourites, toggleFavourite } from '@/backdrop/favourites'
import { useFavourites } from '@/backdrop/useFavourites'
import { Chip } from '@/components/Chip/Chip'
import { HeartIcon } from '@/components/FavouriteHeart/HeartIcon'
import { buildSrcSet, objectPosition, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'
import { availableTags, filterByTag } from '@/photos/tags'
import type { StorageItemOptions } from '@/settings/useStorageItem'

/** Tiles are about 8rem wide, so the 300px rendition covers them even on a 2x screen. */
const TILE_SIZES = '8rem'

type GalleryProps = {
  currentId: string | null
  /** The tag the filter starts on: the one being cycled, when there is just one. */
  initialTag: string | null
  onSelect: (id: string) => void
  photos: readonly Photo[]
  saveOutcome?: StorageItemOptions
}

const photoLabel = (photo: Photo, index: number) =>
  photo.alt ?? photo.location ?? `Photo ${index + 1}`

/**
 * Every photo, to pick the background by hand. The tags only filter what is shown here; which
 * photos get cycled is set above it.
 */
export function Gallery({ currentId, initialTag, onSelect, photos, saveOutcome }: GalleryProps) {
  const tags = useMemo(() => availableTags(photos), [photos])
  const [tag, setTag] = useState<string | null>(() =>
    tags.some(({ slug }) => slug === initialTag) ? initialTag : null,
  )
  const favourites = useFavourites(saveOutcome)
  const presentIds = useMemo(
    () => presentFavourites(favourites.value.ids, photos),
    [favourites.value.ids, photos],
  )
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const shown = useMemo(() => {
    if (favouritesOnly) {
      const order = new Map(presentIds.map((id, index) => [id, index]))
      return photos
        .filter(({ id }) => order.has(id))
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    }
    return filterByTag(photos, tag)
  }, [favouritesOnly, photos, presentIds, tag])
  // Thumbnails that failed to load, drawn as empty tiles rather than broken images.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())

  return (
    <section aria-labelledby="gallery-heading" class="gallery">
      <h3 id="gallery-heading">Gallery</h3>

      {(tags.length > 0 || presentIds.length > 0 || favouritesOnly) && (
        <div aria-label="Filter photos" class="gallery__tags" role="group">
          <Chip
            label="All"
            onClick={() => {
              setFavouritesOnly(false)
              setTag(null)
            }}
            pressed={!favouritesOnly && tag === null}
          />
          {presentIds.length > 0 && (
            <Chip
              label="Favourites"
              onClick={() => {
                setFavouritesOnly((only) => !only)
                setTag(null)
              }}
              pressed={favouritesOnly}
            />
          )}
          {tags.map(({ name, slug }) => (
            <Chip
              key={slug}
              label={name}
              onClick={() => {
                setFavouritesOnly(false)
                setTag(tag === slug ? null : slug)
              }}
              pressed={!favouritesOnly && tag === slug}
            />
          ))}
        </div>
      )}

      <ul class="gallery__grid">
        {shown.map((photo) => {
          const label = photoLabel(photo, photos.indexOf(photo))
          const marked = isFavourite(favourites.value.ids, photo.id)
          return (
            <li class="gallery__item" key={photo.id}>
              <button
                aria-current={photo.id === currentId ? 'true' : undefined}
                aria-label={label}
                class={
                  broken.has(photo.id) ? 'gallery__photo gallery__photo--broken' : 'gallery__photo'
                }
                onClick={() => onSelect(photo.id)}
                type="button"
              >
                <img
                  alt={label}
                  decoding="async"
                  loading="lazy"
                  onError={() => setBroken((failed) => new Set(failed).add(photo.id))}
                  sizes={TILE_SIZES}
                  src={thumbnailUrl(photo)}
                  srcset={buildSrcSet(photo.sizes)}
                  style={{ objectPosition: objectPosition(photo) }}
                />
              </button>
              {photo.id !== 'fallback' && (
                <button
                  aria-label={marked ? `Remove ${label} from favourites` : `Favourite ${label}`}
                  aria-pressed={marked}
                  class="gallery__favourite"
                  disabled={!favourites.loaded || favourites.readOnly}
                  onClick={() =>
                    favourites.set({
                      ...favourites.value,
                      ids: toggleFavourite(favourites.value.ids, photo.id),
                    })
                  }
                  type="button"
                >
                  <HeartIcon filled={marked} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
