import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { CloseIcon } from '@/components/Popover/CloseIcon'
import { usePopover } from '@/components/Popover/usePopover'
import { buildSrcSet, objectPosition, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'
import { availableTags, filterByTag } from '@/photos/tags'

import { splitScroll, wheelPixels } from './growth'

/** Tiles are about 8rem wide, so the 300px rendition covers them even on a 2x screen. */
const TILE_SIZES = '8rem'

type GalleryProps = {
  photos: readonly Photo[]
  currentId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

const photoLabel = (photo: Photo, index: number) =>
  photo.alt ?? photo.location ?? `Photo ${index + 1}`

/**
 * Every photo, to pick the background by hand. Opened with the grid button or the `g` key.
 * Starts a couple of rows tall. Scrolling down first makes it taller, with the top row held in
 * place, and only scrolls the grid once the popover reaches its CSS max-height.
 */
export function Gallery({ photos, currentId, onSelect, onClose }: GalleryProps) {
  const { container, close } = usePopover(onClose)
  const scroller = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLButtonElement>(null)
  const growth = useRef(0)
  const [tag, setTag] = useState<string | null>(null)

  const tags = useMemo(() => availableTags(photos), [photos])
  const shown = useMemo(() => filterByTag(photos, tag), [photos, tag])

  // Set straight on the element: a render per wheel event would be wasted work.
  const setGrowth = (px: number) => {
    growth.current = px
    scroller.current?.style.setProperty('--gallery-grow', `${px}px`)
  }

  // Open on the photo that is showing.
  useEffect(() => {
    current.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  // Only the wheel grows the grid: it can be taken over before anything moves. Undoing a scroll
  // after the fact would show the rows jump. Keys, the scrollbar and touch just scroll.
  useEffect(() => {
    const el = scroller.current
    const dialog = container.current
    if (!el || !dialog) return

    /** Room left to grow: no more than the rows still hidden below, or the popover allows. */
    const roomToGrow = () => {
      const hidden = el.scrollHeight - el.scrollTop - el.clientHeight
      const cap = parseFloat(getComputedStyle(dialog).maxHeight) - dialog.offsetHeight
      return Number.isNaN(cap) ? 0 : Math.max(0, Math.min(hidden, cap))
    }

    const onWheel = (event: WheelEvent) => {
      // Ctrl + wheel, and pinching a trackpad, zoom the page.
      if (event.ctrlKey) return
      const delta = wheelPixels(event, el.clientHeight)
      if (delta <= 0) return
      const { grow, scroll } = splitScroll(delta, roomToGrow())
      if (grow === 0) return
      event.preventDefault()
      setGrowth(growth.current + grow)
      el.scrollTop += scroll
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [container])

  const chooseTag = (slug: string | null) => {
    setTag(slug)
    // A different list starts from the top. The height stays, rather than shrinking under the
    // pointer.
    if (scroller.current) scroller.current.scrollTop = 0
  }

  return (
    <aside ref={container} class="popover gallery" role="dialog" aria-label="Choose a photo">
      <header class="popover__header">
        <h2>Photos</h2>
        <button
          ref={close}
          type="button"
          class="popover__close"
          aria-label="Close photos"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      {tags.length > 0 && (
        <div class="gallery__tags" role="group" aria-label="Filter photos">
          <button
            type="button"
            class="chip"
            aria-pressed={tag === null}
            onClick={() => chooseTag(null)}
          >
            All
          </button>
          {tags.map(({ slug, name }) => (
            <button
              key={slug}
              type="button"
              class="chip"
              aria-pressed={tag === slug}
              onClick={() => chooseTag(tag === slug ? null : slug)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div ref={scroller} class="gallery__scroller">
        <ul class="gallery__grid">
          {shown.map((photo) => {
            const isCurrent = photo.id === currentId
            return (
              <li key={photo.id}>
                <button
                  ref={isCurrent ? current : undefined}
                  type="button"
                  class="gallery__photo"
                  aria-current={isCurrent ? 'true' : undefined}
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
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
