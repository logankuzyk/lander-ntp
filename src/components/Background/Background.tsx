import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { browser } from 'wxt/browser'

import { buildSrcSet, largestUrl, objectPosition, SIZES, thumbnailUrl } from '@/photos/image'
import type { Photo } from '@/photos/schema'

/** Keep in sync with `--photo-fade` in entrypoints/newtab/style.css. */
const FADE_MS = 1200

type PhotoLayerProps = {
  /**
   * True when this layer is covering an earlier photo. Such a layer stays transparent until
   * its own image is ready, so the photo it replaces is never swapped out for a placeholder.
   */
  covering: boolean
  /** Identifies this layer to the stack above; called once the layer is on screen. */
  layerKey: number
  onLoad?: () => void
  onReveal: (key: number) => void
  photo: Photo
}

/** One photo, stacked over whatever came before it. */
function PhotoLayer({ covering, layerKey, onLoad, onReveal, photo }: PhotoLayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const style = { objectPosition: objectPosition(photo) }
  // A covering layer fades in as a whole once it has loaded, so its image needs no fade of
  // its own; the first layer has nothing underneath, so it fades in over its own thumbnail.
  const visible = loaded || !covering
  const layerClass = covering ? 'background__layer background__layer--cover' : 'background__layer'

  useEffect(() => {
    if (visible) onReveal(layerKey)
  }, [visible, layerKey, onReveal])

  const imageClass = loaded ? 'background__full is-loaded' : 'background__full'
  // Keyed so the swap replaces the element rather than patching the dead photo's srcset.
  const image = failed ? (
    <img
      alt=""
      class={imageClass}
      decoding="async"
      key="fallback"
      // Nothing left to fall back to; reveal it so the page is not stuck blank.
      onError={() => setLoaded(true)}
      onLoad={() => setLoaded(true)}
      src={browser.runtime.getURL('/fallback.webp')}
    />
  ) : (
    <img
      alt={photo.alt ?? ''}
      class={imageClass}
      decoding="async"
      key="photo"
      onError={() => {
        // A cached manifest can outlive the images it points at.
        setFailed(true)
        setLoaded(false)
      }}
      onLoad={() => {
        setLoaded(true)
        onLoad?.()
      }}
      sizes={SIZES}
      src={largestUrl(photo)}
      srcset={buildSrcSet(photo.sizes)}
      style={style}
    />
  )

  return (
    <div class={visible ? `${layerClass} is-visible` : layerClass}>
      {/* The blurred thumbnail paints first, under the photo still loading over it. It comes
          from the same manifest entry, so a dead URL takes it down with the full image. */}
      {!covering && !failed && (
        <img alt="" class="background__thumb" src={thumbnailUrl(photo)} style={style} />
      )}
      {image}
    </div>
  )
}

type Layer = {
  covering: boolean
  /** Photos can repeat, so layers carry their own key. */
  key: number
  photo: Photo
}

type BackgroundProps = {
  /** Lay a slight wash over the photo, so light text holds up over bright ones. */
  dim?: boolean
  /** Called once the full-resolution image has loaded. */
  onLoad?: () => void
  /**
   * Called as a replacement photo starts and finishes loading. A cross-fade holds the photo
   * on screen until the new one is ready, so pressing "next photo" on a cold cache would
   * otherwise look like nothing happened. Must be a stable reference.
   */
  onLoadingChange?: (loading: boolean) => void
  photo: Photo
}

/**
 * Full-screen photo. A new photo loads behind the scenes and cross-fades over the one it
 * replaces, so the page never cuts back to a blurred placeholder mid-rotation (the very
 * first photo has nothing to fade over, so it shows its thumbnail while it loads).
 *
 * Under prefers-reduced-motion the swap is instant.
 */
export function Background({ dim, onLoad, onLoadingChange, photo }: BackgroundProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ covering: false, key: 0, photo }])
  const [revealedKey, setRevealedKey] = useState(0)
  const nextKey = useRef(0)
  const topKey = useRef(0)
  const settling = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setLayers((current) => {
      const top = current[current.length - 1]
      if (top?.photo.id === photo.id) return current
      nextKey.current += 1
      return [...current, { covering: true, key: nextKey.current, photo }]
    })
  }, [photo])

  useEffect(() => () => clearTimeout(settling.current), [])

  /** Once the top layer has finished fading in, the ones under it can go. */
  const settle = useCallback((key: number) => {
    // Only the top layer settles the stack. The incoming photo is usually preloaded, so it
    // can land before the one it was stacked on: letting that straggler through would cancel
    // the pending trim and leave `loading` pointing at a key that is no longer on top.
    if (key !== topKey.current) return
    setRevealedKey(key)
    clearTimeout(settling.current)
    settling.current = setTimeout(() => {
      setLayers((current) => {
        const top = current[current.length - 1]
        return current.length > 1 && top?.key === key ? [top] : current
      })
    }, FADE_MS)
  }, [])

  const top = layers[layers.length - 1]
  // Set during render, and read by `settle` from a layer's effect once this render is on screen.
  topKey.current = top?.key ?? 0
  const loading = top !== undefined && top.covering && top.key !== revealedKey

  useEffect(() => {
    onLoadingChange?.(loading)
  }, [loading, onLoadingChange])

  useEffect(() => {
    return () => onLoadingChange?.(false)
  }, [onLoadingChange])

  return (
    <div class={dim ? 'background background--dim' : 'background'}>
      {layers.map((layer) => (
        <PhotoLayer
          covering={layer.covering}
          key={layer.key}
          layerKey={layer.key}
          onLoad={onLoad}
          onReveal={settle}
          photo={layer.photo}
        />
      ))}
    </div>
  )
}
