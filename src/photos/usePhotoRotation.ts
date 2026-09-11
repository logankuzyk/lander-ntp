import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { getManifest } from './manifest'
import {
  msUntilAdvance,
  nextPhoto,
  photoForVisit,
  type Frequency,
  type PhotoState,
} from './rotation'
import type { Manifest, Photo } from './schema'
import { photoState } from './storage'

const photoIds = (manifest: Manifest) => manifest.photos.map((photo) => photo.id)

export type PhotoRotation = {
  photo: Photo | null
  /** The photo that comes next, for preloading. */
  upcoming: Photo | null
  next: () => void
}

/**
 * Loads the manifest, picks the photo for this visit and, for interval frequencies, moves on
 * while the tab stays open. `next()` always works; with `off` the new photo stays pinned.
 */
export function usePhotoRotation(frequency: Frequency): PhotoRotation {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [state, setState] = useState<PhotoState | null>(null)
  const frequencyRef = useRef(frequency)

  useEffect(() => {
    frequencyRef.current = frequency
  }, [frequency])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { manifest } = await getManifest()
      const stored = await photoState.getValue()
      const visit = photoForVisit(frequencyRef.current, stored, photoIds(manifest), Date.now())
      if (visit !== stored) await photoState.setValue(visit)
      if (cancelled) return
      setManifest(manifest)
      setState(visit)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const next = useCallback(() => {
    if (!manifest) return
    const advanced = nextPhoto(state, photoIds(manifest), Date.now())
    setState(advanced)
    void photoState.setValue(advanced)
  }, [manifest, state])

  useEffect(() => {
    if (!state) return
    const delay = msUntilAdvance(frequency, state, Date.now())
    if (delay === null) return
    const timer = setTimeout(next, delay)
    return () => clearTimeout(timer)
  }, [frequency, state, next])

  return useMemo(() => {
    const find = (id: string | null | undefined) =>
      manifest?.photos.find((photo) => photo.id === id) ?? null
    const photo = find(state?.currentId)
    const upcoming = find(state?.bag[0])
    return { photo, upcoming: upcoming === photo ? null : upcoming, next }
  }, [manifest, state, next])
}
