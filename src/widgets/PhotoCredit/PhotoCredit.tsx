import { Fragment } from 'preact'

import type { Photo } from '@/photos/schema'

type PhotoCreditProps = {
  photo: Photo
}

/** Bottom-left: location · View on logankuzyk.com · Buy a print (when available). */
export function PhotoCredit({ photo }: PhotoCreditProps) {
  const items = [
    photo.location && <span key="location">{photo.location}</span>,
    <a key="page" href={photo.pageUrl}>
      View on logankuzyk.com
    </a>,
    photo.printUrl && (
      <a key="print" href={photo.printUrl}>
        Buy a print
      </a>
    ),
  ].filter(Boolean)

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
