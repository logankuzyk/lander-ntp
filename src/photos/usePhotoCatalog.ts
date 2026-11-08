import { useEffect, useState } from 'preact/hooks'

import { getManifest } from './manifest'
import type { Photo } from './schema'

const NO_PHOTOS: Photo[] = []

/** Load photos for the Photos section without starting or advancing photo rotation. */
export function usePhotoCatalog(enabled: boolean): Photo[] {
  const [photos, setPhotos] = useState<Photo[]>(NO_PHOTOS)

  useEffect(() => {
    if (!enabled) return
    let active = true
    void getManifest().then(({ manifest }) => {
      if (active) setPhotos(manifest.photos)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return photos
}
