import { useState } from 'preact/hooks'
import { browser } from 'wxt/browser'

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
 *
 * A cached manifest can outlive the images it points at, so a failed load swaps in the
 * bundled photo rather than leaving the page on a placeholder that never resolves.
 */
export function Background({ photo, onLoad }: BackgroundProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const style = { objectPosition: objectPosition(photo) }
  const className = loaded ? 'background__full is-loaded' : 'background__full'

  if (failed) {
    return (
      <div class="background">
        <img
          class={className}
          src={browser.runtime.getURL('/fallback.webp')}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          // Nothing left to fall back to; reveal it so the page is not stuck blank.
          onError={() => setLoaded(true)}
        />
      </div>
    )
  }

  return (
    <div class="background">
      <img class="background__thumb" src={thumbnailUrl(photo)} alt="" style={style} />
      <img
        class={className}
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
        onError={() => {
          setFailed(true)
          setLoaded(false)
        }}
      />
    </div>
  )
}
