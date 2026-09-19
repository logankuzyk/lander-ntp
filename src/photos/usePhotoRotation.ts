import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { getManifest } from './manifest'
import {
  msUntilAdvance,
  nextPhoto,
  paceOf,
  photoForSettings,
  shouldAdvance,
  type Pace,
  type PhotoIds,
  type PhotoSettings,
  type PhotoState,
} from './rotation'
import type { Manifest, Photo } from './schema'
import { photoState } from './storage'
import { poolIds } from './tags'

const idsFor = (manifest: Manifest, tag: string | null): PhotoIds => ({
  all: manifest.photos.map((photo) => photo.id),
  pool: poolIds(manifest.photos, tag),
})

/**
 * `every-visit` is the only pace where each tab gets its own photo. Every other one shows one
 * photo at a time, so open tabs follow the shared state instead of drifting apart.
 */
const sharesPhoto = (pace: Pace) => pace !== 'every-visit'

const NO_PHOTOS: Photo[] = []

export type PhotoRotation = {
  /** Every photo in the manifest; empty until it has loaded. */
  photos: Photo[]
  photo: Photo | null
  /** The photo that comes next, for preloading. Null while a photo is pinned. */
  upcoming: Photo | null
  /** Move on to the next photo from the pool. Resolves with its id once it is shared. */
  next: () => Promise<string | null>
}

/**
 * Loads the manifest, picks the photo for this visit and, while cycling on an interval, moves
 * on as the tab stays open. Follows the photo settings as they change: pinning a photo shows
 * it, and cycling a tag moves off a photo without it.
 *
 * Pass null until the stored settings have loaded: deciding against the defaults would move
 * the photo on in every new tab, whatever the settings say.
 */
export function usePhotoRotation(settings: PhotoSettings | null): PhotoRotation {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [state, setState] = useState<PhotoState | null>(null)
  const settingsRef = useRef(settings)
  const stateRef = useRef(state)
  const visited = useRef(false)

  settingsRef.current = settings
  stateRef.current = state

  const pace = settings ? paceOf(settings) : null
  const mode = settings?.mode
  const tag = settings?.tag ?? null
  const pinnedId = settings?.pinnedId ?? null

  // Runs once, on the first known settings.
  useEffect(() => {
    if (settings === null || visited.current) return
    visited.current = true

    let cancelled = false
    void (async () => {
      const { manifest } = await getManifest()
      const stored = await photoState.getValue()
      const visit = photoForSettings(
        settings,
        stored,
        idsFor(manifest, settings.tag),
        Date.now(),
        true,
      )
      if (visit !== stored) await photoState.setValue(visit)
      if (cancelled) return
      setManifest(manifest)
      setState(visit)
    })()
    return () => {
      cancelled = true
    }
  }, [settings])

  // The settings changed while the tab is open (here, in another tab or on another device).
  useEffect(() => {
    const current = settingsRef.current
    const shown = stateRef.current
    if (!manifest || !current || !shown) return
    const next = photoForSettings(current, shown, idsFor(manifest, tag), Date.now(), false)
    if (next === shown) return
    setState(next)
    void photoState.setValue(next)
  }, [manifest, mode, tag, pinnedId])

  /**
   * Draw the next photo from the pool. `onlyIfDue` is for the timer: another tab may have
   * advanced first, and following it beats taking a second photo out of the bag.
   */
  const advance = useCallback(
    async ({ onlyIfDue = false } = {}): Promise<string | null> => {
      const current = settingsRef.current
      if (!manifest || !current) return null
      const stored = await photoState.getValue()

      if (onlyIfDue && stored && !shouldAdvance(paceOf(current), stored, Date.now())) {
        setState(stored)
        return stored.currentId
      }

      const advanced = nextPhoto(stored, idsFor(manifest, current.tag).pool, Date.now())
      setState(advanced)
      await photoState.setValue(advanced)
      return advanced.currentId
    },
    [manifest],
  )

  const next = useCallback(() => advance(), [advance])

  // Follow the shared photo: another tab's timer, or its next-photo button.
  useEffect(() => {
    if (pace === null || !sharesPhoto(pace)) return
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
  }, [pace])

  useEffect(() => {
    if (!state || pace === null) return
    const delay = msUntilAdvance(pace, state, Date.now())
    if (delay === null) return
    const timer = setTimeout(() => {
      void advance({ onlyIfDue: true })
    }, delay)
    return () => clearTimeout(timer)
  }, [pace, state, advance])

  return useMemo(() => {
    const find = (id: string | null | undefined) =>
      manifest?.photos.find((photo) => photo.id === id) ?? null
    const photo = find(state?.currentId)
    const upcoming = mode === 'pinned' ? null : find(state?.bag[0])
    return {
      photos: manifest?.photos ?? NO_PHOTOS,
      photo,
      upcoming: upcoming === photo ? null : upcoming,
      next,
    }
  }, [manifest, state, mode, next])
}
