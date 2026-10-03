import { CloseIcon } from '@/components/Popover/CloseIcon'
import { usePopover } from '@/components/Popover/usePopover'
import type { Photo } from '@/photos/schema'
import { formatDateTaken } from '@/utils/time'

type PhotoInfoProps = {
  /** Overrides the browser locale; for tests. */
  locale?: string
  onClose: () => void
  photo: Photo
}

/** Camera settings for the current photo. Opened with the ⓘ button or the `i` key. */
export function PhotoInfo({ locale, onClose, photo }: PhotoInfoProps) {
  const { close, container } = usePopover(onClose)

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
    <aside aria-label="Photo details" class="popover photo-info" ref={container} role="dialog">
      <header class="popover__header">
        <h2>Photo details</h2>
        <button
          aria-label="Close photo details"
          class="popover__close"
          onClick={onClose}
          ref={close}
          type="button"
        >
          <CloseIcon />
        </button>
      </header>

      {rows.length > 0 ? (
        <dl class="photo-info__rows">
          {rows.map(([label, value]) => (
            <div class="photo-info__row" key={label}>
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
