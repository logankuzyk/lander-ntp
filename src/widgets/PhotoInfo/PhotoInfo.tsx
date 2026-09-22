import { CloseIcon } from '@/components/Popover/CloseIcon'
import { usePopover } from '@/components/Popover/usePopover'
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
  const { container, close } = usePopover(onClose)

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
    <aside ref={container} class="popover photo-info" role="dialog" aria-label="Photo details">
      <header class="popover__header">
        <h2>Photo details</h2>
        <button
          ref={close}
          type="button"
          class="popover__close"
          aria-label="Close photo details"
          onClick={onClose}
        >
          <CloseIcon />
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
