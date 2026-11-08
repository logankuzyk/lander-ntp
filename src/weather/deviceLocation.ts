import { storage } from 'wxt/utils/storage'

export type Coordinates = { latitude: number; longitude: number }

/** A position, with the name of the town there when that could be looked up. */
export type DevicePosition = Coordinates & { name: string | null }

/** What the settings call a place that follows the device, and the widget one it has no name for. */
export const CURRENT_LOCATION = 'Current location'

/**
 * Where the device last was, for the next new tab to start from. Local, not synced: it is this
 * device's, and the settings only say that the weather follows it.
 */
export const devicePosition = storage.defineItem<DevicePosition>('local:weatherPosition')

/** How long the browser may reuse a position, and how long to wait for a new one. */
const MAX_AGE_MS = 10 * 60 * 1000
const TIMEOUT_MS = 10_000

/**
 * Closer than this (about five kilometres) is the same place: the forecast would be the same,
 * and a position that wobbles by a street shouldn't fetch it again.
 */
const NEARBY_DEGREES = 0.05

export const near = (a: Coordinates, b: Coordinates) =>
  Math.abs(a.latitude - b.latitude) < NEARBY_DEGREES &&
  Math.abs(a.longitude - b.longitude) < NEARBY_DEGREES

/** Two decimals is about a kilometre: plenty for weather, and no more precise than a town. */
const round = (degrees: number) => Math.round(degrees * 100) / 100

/**
 * Ask the browser where the device is. The first call shows its permission prompt, so that one
 * belongs to a click. Null when it is refused, unavailable or takes too long.
 */
export const locate = (): Promise<Coordinates | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: round(coords.latitude), longitude: round(coords.longitude) }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: MAX_AGE_MS, timeout: TIMEOUT_MS },
    )
  })

/**
 * How long a click's question about the location waits for an answer. A prompt left open (or
 * lost with the tab out of view) can leave `locate` waiting for ever; the setup button waits for
 * its action to settle before it can be pressed again.
 */
const ASK_PATIENCE_MS = 60_000

/**
 * `locate` for the setup button: asks the browser before it returns, so a click's own call
 * shows the prompt, and gives up with null, as a refusal does, if nothing has answered after
 * `giveUpMs`. The prompt, if it is still up, stays up and is answered as usual: whatever it
 * grants is noticed when the browser says the permission changed.
 */
export function askForLocation(giveUpMs = ASK_PATIENCE_MS): Promise<Coordinates | null> {
  const answer = locate()
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), giveUpMs)
    void answer.then((position) => {
      clearTimeout(timer)
      resolve(position)
    })
  })
}

/**
 * Whether `locate` can answer without a prompt. Settings sync, so a device can be told to
 * follow its location before anyone has allowed that on it; a new tab shouldn't ask unbidden.
 */
export async function locationAllowed(): Promise<boolean> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'
  } catch {
    return false
  }
}
