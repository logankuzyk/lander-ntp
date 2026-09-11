import { useState } from 'preact/hooks'

import { buildSrcSet, largestUrl, objectPosition, SIZES, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'

type BackgroundProps = {
  photo: Photo
  /** Called once the full-resolution image has loaded. */
  onLoad?: () => void
}

/**
 * Full-screen photo. The blurred thumbnail paints first and the full image fades in over it
 * (instantly under prefers-reduced-motion). Key it by photo id so the fade restarts.
 */
export function Background({ photo, onLoad }: BackgroundProps) {
  const [loaded, setLoaded] = useState(false)
  const style = { objectPosition: objectPosition(photo) }

  return (
    <div class="background">
      <img class="background__thumb" src={thumbnailUrl(photo)} alt="" style={style} />
      <img
        class={loaded ? 'background__full is-loaded' : 'background__full'}
        src={largestUrl(photo)}
        srcset={buildSrcSet(photo.sizes)}
        sizes={SIZES}
        alt={photo.alt ?? ''}
        decoding="async"
        style={style}
        onLoad={() => {
          setLoaded(true)
          onLoad?.()
        }}
      />
    </div>
  )
}
