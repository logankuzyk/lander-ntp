import { useState } from 'preact/hooks'

import { faviconUrl, monogram } from '@/favourites/icon'
import type { Favourite } from '@/favourites/schema'

type FavouriteIconProps = {
  favourite: Favourite
  size?: number
}

/** Chromium's cached favicon, falling back to a coloured letter (always, on Firefox). */
export function FavouriteIcon({ favourite, size = 16 }: FavouriteIconProps) {
  const [failed, setFailed] = useState(false)
  // Ask for twice the rendered size so the icon stays sharp on HiDPI screens.
  const src = failed ? null : faviconUrl(favourite.url, size * 2)

  if (src) {
    return (
      <img
        class="favourite__icon"
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    )
  }

  const { letter, color } = monogram(favourite.title, favourite.url)
  return (
    <span
      class="favourite__icon favourite__icon--monogram"
      aria-hidden="true"
      style={{ background: color, width: size, height: size, fontSize: Math.round(size * 0.6) }}
    >
      {letter}
    </span>
  )
}
