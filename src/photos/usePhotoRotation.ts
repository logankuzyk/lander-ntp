import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { getManifest } from './manifest'
import {
  msUntilAdvance,
  nextPhoto,
  photoForVisit,
  shouldAdvance,
  type Frequency,
  type PhotoState,
} from './rotation'
import type { Manifest, Photo } from './schema'
import { photoState } from './storage'

const photoIds = (manifest: Manifest) => manifest.photos.map((photo) => photo.id)

/**
 * `every-visit` is the only frequency where each tab gets its own photo. Every other mode
 * shows one photo at a time, so open tabs follow the shared state instead of drifting apart.
 */
const sharesPhoto = (frequency: Frequency) => frequency !== 'every-visit'

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

  /**
   * Draw the next photo. `onlyIfDue` is for the timer: another tab may have advanced first,
   * and following it beats taking a second photo out of the bag.
   */
  const advance = useCallback(
    async ({ onlyIfDue = false } = {}) => {
      if (!manifest) return
      const stored = await photoState.getValue()

      if (onlyIfDue && stored && !shouldAdvance(frequencyRef.current, stored, Date.now())) {
        setState(stored)
        return
      }

      const advanced = nextPhoto(stored, photoIds(manifest), Date.now())
      setState(advanced)
      await photoState.setValue(advanced)
    },
    [manifest],
  )

  const next = useCallback(() => {
    void advance()
  }, [advance])

  // Follow the shared photo: another tab's timer, or its next-photo button.
  useEffect(() => {
    if (!sharesPhoto(frequency)) return
    let active = true
    void photoState.getValue().then((stored) => {
      if (active && stored) setState(stored)
    })
    const unwatch = photoState.watch((stored) => {
      if (stored) setState(stored)
    })
    return () => {
      active = false
      unwatch()
    }
  }, [frequency])

  useEffect(() => {
    if (!state) return
    const delay = msUntilAdvance(frequency, state, Date.now())
    if (delay === null) return
    const timer = setTimeout(() => {
      void advance({ onlyIfDue: true })
    }, delay)
    return () => clearTimeout(timer)
  }, [frequency, state, advance])

  return useMemo(() => {
    const find = (id: string | null | undefined) =>
      manifest?.photos.find((photo) => photo.id === id) ?? null
    const photo = find(state?.currentId)
    const upcoming = find(state?.bag[0])
    return { photo, upcoming: upcoming === photo ? null : upcoming, next }
  }, [manifest, state, next])
}
