import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { useBackground } from '@/backdrop/useBackground'
import { useFavourites } from '@/backdrop/useFavourites'

import { getManifest } from './manifest'
import { poolFor } from './pool'
import {
  choosePhoto,
  msUntilAdvance,
  nextPhoto,
  type Pace,
  paceOf,
  photoForSettings,
  type PhotoIds,
  type PhotoSettings,
  type PhotoState,
  shouldAdvance,
} from './rotation'
import type { Manifest, Photo } from './schema'
import { photoState } from './storage'

const idsFor = (
  manifest: Manifest,
  tags: readonly string[],
  favourites: readonly string[],
  favouritesOnly: boolean,
): PhotoIds => ({
  all: manifest.photos.map((photo) => photo.id),
  pool: poolFor({ favourites, favouritesOnly, photos: manifest.photos, tags }).ids,
})

/**
 * `every-visit` is the only pace where each tab gets its own photo. Every other one shows one
 * photo at a time, so open tabs follow the shared state instead of drifting apart.
 */
const sharesPhoto = (pace: Pace) => pace !== 'every-visit'

const NO_PHOTOS: Photo[] = []

export type PhotoRotation = {
  /** True when Favourites only is on but none of those photos are in the manifest. */
  favouritesGone: boolean
  /** Move on to the next photo from the pool. Resolves with its id once it is shared. */
  next: () => Promise<string | null>
  photo: Photo | null
  /** Every photo in the manifest; empty until it has loaded. */
  photos: Photo[]
  /** Show a photo picked from the gallery without changing the cycling settings. */
  select: (id: string) => Promise<void>
  /** The photo that comes next, for preloading. Null while a photo is pinned. */
  upcoming: Photo | null
}

/**
 * Loads the manifest, picks the photo for this visit and, while cycling on an interval, moves
 * on as the tab stays open. Follows the photo settings as they change: pinning a photo shows
 * it, and cycling tags moves off a photo without any of them.
 *
 * Pass null until the stored settings have loaded: deciding against the defaults would move
 * the photo on in every new tab, whatever the settings say.
 */
export function usePhotoRotation(settings: PhotoSettings | null): PhotoRotation {
  const background = useBackground()
  const favourites = useFavourites()
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [state, setState] = useState<PhotoState | null>(null)
  const settingsRef = useRef(settings)
  const backgroundRef = useRef(background.value)
  const favouritesRef = useRef(favourites.value)
  const stateRef = useRef(state)
  const visited = useRef(false)
  const unmounted = useRef(false)
  const pendingSelection = useRef<string | null>(null)

  settingsRef.current = settings
  backgroundRef.current = background.value
  favouritesRef.current = favourites.value
  stateRef.current = state

  const pace = settings ? paceOf(settings) : null
  const mode = settings?.mode
  // A string, so the effect below only reruns when the tags themselves change.
  const tagKey = settings?.tags.join(' ') ?? ''
  const pinnedId = settings?.pinnedId ?? null
  const favouritesOnly = background.value.favouritesOnly

  // Runs once, on the first known settings. Keyed on whether they are known rather than on
  // the settings object: App passes a new one on every settings write, and a change landing
  // mid-fetch must not cancel the only first visit this tab gets.
  const settingsKnown = settings !== null && background.loaded && favourites.loaded
  useEffect(() => {
    const first = settingsRef.current
    if (!first || !background.loaded || !favourites.loaded || visited.current) return
    visited.current = true

    void (async () => {
      const { manifest } = await getManifest()
      const stored = await photoState.getValue()
      // The latest settings, in case they changed while the manifest loaded.
      const current = settingsRef.current ?? first
      const currentBackground = backgroundRef.current
      const currentFavourites = favouritesRef.current
      let visit = photoForSettings(
        current,
        stored,
        idsFor(manifest, current.tags, currentFavourites.ids, currentBackground.favouritesOnly),
        Date.now(),
        true,
      )
      const selection = pendingSelection.current
      if (selection !== null) {
        pendingSelection.current = null
        const ids = manifest.photos.map((photo) => photo.id)
        if (ids.includes(selection)) {
          const chosen = choosePhoto(visit, selection, ids, Date.now())
          if (chosen) visit = { ...chosen, pickedByUser: true }
        }
      }
      if (visit !== stored) await photoState.setValue(visit)
      if (unmounted.current) return
      setManifest(manifest)
      setState(visit)
    })()
  }, [background.loaded, favourites.loaded, settingsKnown])

  useEffect(
    () => () => {
      unmounted.current = true
    },
    [],
  )

  // The settings changed while the tab is open (here, in another tab or on another device).
  useEffect(() => {
    const current = settingsRef.current
    const shown = stateRef.current
    if (!manifest || !current || !shown) return
    const next = photoForSettings(
      current,
      shown,
      idsFor(
        manifest,
        current.tags,
        favouritesRef.current.ids,
        backgroundRef.current.favouritesOnly,
      ),
      Date.now(),
      false,
    )
    if (next === shown) return
    setState(next)
    void photoState.setValue(next)
    // tagKey stands in for current.tags, which is read through the ref.
  }, [manifest, mode, tagKey, pinnedId, favouritesOnly])

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

      const advanced = nextPhoto(
        stored,
        idsFor(
          manifest,
          current.tags,
          favouritesRef.current.ids,
          backgroundRef.current.favouritesOnly,
        ).pool,
        Date.now(),
      )
      setState(advanced)
      await photoState.setValue(advanced)
      return advanced.currentId
    },
    [manifest],
  )

  const next = useCallback(() => advance(), [advance])

  const select = useCallback(
    async (id: string) => {
      if (!manifest) {
        pendingSelection.current = id
        return
      }
      const selected = choosePhoto(
        stateRef.current,
        id,
        manifest.photos.map((photo) => photo.id),
        Date.now(),
      )
      if (!selected) return
      const picked = { ...selected, pickedByUser: true as const }
      stateRef.current = picked
      setState(picked)
      await photoState.setValue(picked)
    },
    [manifest],
  )

  // Follow the shared photo: another tab's timer, or its next-photo button.
  useEffect(() => {
    if (!settingsKnown || pace === null || !sharesPhoto(pace)) return
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
  }, [pace, settingsKnown])

  useEffect(() => {
    if (!settingsKnown || !manifest || !state || pace === null) return
    const delay = msUntilAdvance(pace, state, Date.now())
    if (delay === null) return
    const timer = setTimeout(() => {
      void advance({ onlyIfDue: true })
    }, delay)
    return () => clearTimeout(timer)
  }, [manifest, pace, settingsKnown, state, advance])

  return useMemo(() => {
    const find = (id: string | null | undefined) =>
      manifest?.photos.find((photo) => photo.id === id) ?? null
    const photo = find(state?.currentId)
    // The bag can still hold photos from before the tags changed; the next draw skips them.
    const pool = new Set(
      manifest
        ? poolFor({
            favourites: favourites.value.ids,
            favouritesOnly: background.value.favouritesOnly,
            photos: manifest.photos,
            tags: tagKey ? tagKey.split(' ') : [],
          }).ids
        : [],
    )
    const favouritesGone = manifest
      ? poolFor({
          favourites: favourites.value.ids,
          favouritesOnly: background.value.favouritesOnly,
          photos: manifest.photos,
          tags: tagKey ? tagKey.split(' ') : [],
        }).favouritesGone
      : false
    const upcoming = mode === 'pinned' ? null : find(state?.bag.find((id) => pool.has(id)))
    return {
      favouritesGone,
      next,
      photo,
      photos: manifest?.photos ?? NO_PHOTOS,
      select,
      upcoming: upcoming === photo ? null : upcoming,
    }
  }, [
    manifest,
    state,
    mode,
    tagKey,
    next,
    select,
    favourites.value.ids,
    background.value.favouritesOnly,
  ])
}
