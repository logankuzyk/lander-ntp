export const FREQUENCIES = [
  'off',
  'every-visit',
  '30s',
  '1m',
  '5m',
  '15m',
  '1h',
  '6h',
  '12h',
  'daily',
] as const

export type Frequency = (typeof FREQUENCIES)[number]

export type PhotoState = {
  currentId: string | null
  /** Epoch ms when the current photo was first shown. */
  shownAt: number
  /**
   * Shuffle bag of upcoming ids; `bag[0]` is next. Refilled as soon as it empties, so the
   * upcoming photo is always known (for preloading).
   */
  bag: string[]
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

const INTERVALS: Partial<Record<Frequency, number>> = {
  '30s': 30 * SECOND,
  '1m': MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '1h': HOUR,
  '6h': 6 * HOUR,
  '12h': 12 * HOUR,
}

/**
 * When the current photo is due to change, or null for modes that don't change on a timer
 * (`off`, `every-visit`). `daily` changes at the next local midnight.
 */
export function nextAdvanceAt(frequency: Frequency, state: PhotoState): number | null {
  if (frequency === 'daily') {
    const midnight = new Date(state.shownAt)
    midnight.setHours(24, 0, 0, 0)
    return midnight.getTime()
  }
  const interval = INTERVALS[frequency]
  return interval === undefined ? null : state.shownAt + interval
}

/** Whether a new visit (or a due timer) should move on from the current photo. */
export function shouldAdvance(
  frequency: Frequency,
  state: PhotoState | null,
  now: number,
): boolean {
  if (!state?.currentId) return true
  if (frequency === 'off') return false
  if (frequency === 'every-visit') return true
  const at = nextAdvanceAt(frequency, state)
  return at !== null && now >= at
}

/** Delay for the in-tab timer, or null when the frequency has no timer. */
export function msUntilAdvance(
  frequency: Frequency,
  state: PhotoState,
  now: number,
): number | null {
  const at = nextAdvanceAt(frequency, state)
  return at === null ? null : Math.max(0, at - now)
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

function refill(ids: readonly string[], last: string | null, random: () => number): string[] {
  const bag = shuffle([...new Set(ids)], random)
  // Never show the same photo twice in a row across a bag boundary.
  if (bag.length > 1 && bag[0] === last) {
    ;[bag[0], bag[bag.length - 1]] = [bag[bag.length - 1] as string, bag[0]]
  }
  return bag
}

/**
 * Draw the next photo from the shuffle bag: no repeats until every photo has been shown.
 * Ids no longer in the manifest are skipped.
 */
export function nextPhoto(
  state: PhotoState | null,
  ids: readonly string[],
  now: number,
  random: () => number = Math.random,
): PhotoState {
  const available = new Set(ids)
  const pending = (state?.bag ?? []).filter((id) => available.has(id))
  const [next = null, ...rest] =
    pending.length > 0 ? pending : refill(ids, state?.currentId ?? null, random)

  return {
    currentId: next,
    shownAt: now,
    bag: rest.length > 0 ? rest : refill(ids, next, random),
  }
}

/**
 * The photo to show when a new tab opens. Keeps the current photo unless the frequency says
 * to move on or it has left the manifest.
 */
export function photoForVisit(
  frequency: Frequency,
  state: PhotoState | null,
  ids: readonly string[],
  now: number,
  random: () => number = Math.random,
): PhotoState {
  if (
    state?.currentId != null &&
    ids.includes(state.currentId) &&
    !shouldAdvance(frequency, state, now)
  ) {
    return state
  }
  return nextPhoto(state, ids, now, random)
}

/**
 * Show a photo picked by hand. It leaves the bag, so it isn't drawn again straight after.
 * Ids not in the manifest are ignored.
 */
export function choosePhoto(
  state: PhotoState | null,
  id: string,
  ids: readonly string[],
  now: number,
  random: () => number = Math.random,
): PhotoState | null {
  const available = new Set(ids)
  if (!available.has(id)) return state
  const bag = (state?.bag ?? []).filter((queued) => queued !== id && available.has(queued))
  return { currentId: id, shownAt: now, bag: bag.length > 0 ? bag : refill(ids, id, random) }
}
