import { Fragment } from 'preact'

import type { Photo } from '@/photos/schema'

type PhotoCreditProps = {
  photo: Photo
}

/**
 * Bottom-left: location · Buy a print (when available). The link through to the photo's page
 * on logankuzyk.com lives in the photo details panel, not here.
 */
export function PhotoCredit({ photo }: PhotoCreditProps) {
  const items = [
    photo.location && <span key="location">{photo.location}</span>,
    photo.printUrl && (
      <a key="print" href={photo.printUrl}>
        Buy a print
      </a>
    ),
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <p class="credit">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden="true">·</span>}
          {item}
        </Fragment>
      ))}
    </p>
  )
}
