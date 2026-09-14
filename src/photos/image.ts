import type { Photo } from './schema'

/** The background always covers the viewport. */
export const SIZES = '100vw'

export const buildSrcSet = (sizes: Photo['sizes']): string =>
  sizes.map(({ url, width }) => `${url} ${width}w`).join(', ')

/** Smallest rendition, shown blurred while the full image loads. */
export const thumbnailUrl = (photo: Photo): string => photo.sizes[0]?.url ?? ''

/** Largest rendition, the `src` fallback for browsers that ignore `srcset`. */
export const largestUrl = (photo: Photo): string => photo.sizes[photo.sizes.length - 1]?.url ?? ''

/** Keep the photo's focal point in frame when `object-fit: cover` crops it. */
export const objectPosition = ({ focalX, focalY }: Pick<Photo, 'focalX' | 'focalY'>): string =>
  `${focalX ?? 50}% ${focalY ?? 50}%`

/** Warm the HTTP cache with the next photo so the next new tab paints straight away. */
export function preloadNext(photo: Photo): HTMLImageElement[] {
  const thumbnail = new Image()
  thumbnail.src = thumbnailUrl(photo)

  const full = new Image()
  full.sizes = SIZES
  full.srcset = buildSrcSet(photo.sizes)
  full.src = largestUrl(photo)

  return [thumbnail, full]
}
