import { useEffect, useRef } from 'preact/hooks'

import type { Photo } from '@/photos/schema'
import { formatDateTaken } from '@/utils/time'

type PhotoInfoProps = {
  photo: Photo
  onClose: () => void
  /** Overrides the browser locale; for tests. */
  locale?: string
}

/** Camera settings for the current photo. Opened with the ⓘ button or the `i` key. */
export function PhotoInfo({ photo, onClose, locale }: PhotoInfoProps) {
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement
    close.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const { exif } = photo
  const rows: [string, string][] = [
    ['Camera', exif.camera],
    ['Focal length', exif.focalLength],
    ['Aperture', exif.aperture],
    ['Shutter', exif.shutter],
    ['ISO', exif.iso],
    ['Taken', formatDateTaken(exif.dateTaken, locale)],
    ['Location', photo.location],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <aside class="photo-info" role="dialog" aria-label="Photo details">
      <header class="photo-info__header">
        <h2>Photo details</h2>
        <button
          ref={close}
          type="button"
          class="photo-info__close"
          aria-label="Close photo details"
          onClick={onClose}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {rows.length > 0 ? (
        <dl class="photo-info__rows">
          {rows.map(([label, value]) => (
            <div key={label} class="photo-info__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p class="photo-info__empty">No camera details for this photo.</p>
      )}

      <p class="photo-info__links">
        <a href={photo.pageUrl}>View on logankuzyk.com</a>
        {photo.printUrl && <a href={photo.printUrl}>Buy a print</a>}
      </p>
    </aside>
  )
}
