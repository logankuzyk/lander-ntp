import { vi } from 'vitest'
import { browser } from 'wxt/browser'

type PermissionEvent = 'onAdded' | 'onRemoved'

/**
 * Stands in for the browser's permission events, which the test browser does not have: keeps
 * the listeners given to `permissions.onAdded` and `onRemoved`, and fires them on demand. The
 * spies are put back by `vi.restoreAllMocks`.
 */
export function permissionEvents() {
  const listeners: Record<PermissionEvent, Set<() => void>> = {
    onAdded: new Set(),
    onRemoved: new Set(),
  }
  for (const name of ['onAdded', 'onRemoved'] as const) {
    vi.spyOn(browser.permissions[name], 'addListener').mockImplementation(((listener: () => void) =>
      listeners[name].add(listener)) as never)
    vi.spyOn(browser.permissions[name], 'removeListener').mockImplementation(((
      listener: () => void,
    ) => listeners[name].delete(listener)) as never)
  }
  return {
    /** Tells every listener the browser added (or removed) a permission. */
    fire: (name: PermissionEvent) => {
      for (const listener of [...listeners[name]]) listener()
    },
    /** How many are listening, to either. */
    listening: () => listeners.onAdded.size + listeners.onRemoved.size,
  }
}

/**
 * Stands in for the page's view of the device: whether location is allowed, which can change
 * (`set` says it did, as the browser does), and `getCurrentPosition`, which answers at once with
 * `coords`. Replaces `navigator` until `vi.unstubAllGlobals`.
 */
export function device(
  state: PermissionState = 'prompt',
  coords = { latitude: 48.43, longitude: -123.37 },
) {
  const status = Object.assign(new EventTarget(), { state })
  const getCurrentPosition = vi.fn((done: (position: unknown) => void) => done({ coords }))
  const query = vi.fn(() => Promise.resolve(status))
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    language: 'en-CA',
    permissions: { query },
  })
  return {
    getCurrentPosition,
    query,
    /** The permission was granted or taken back, in the address bar or the settings. */
    set: (next: PermissionState) => {
      status.state = next
      status.dispatchEvent(new Event('change'))
    },
    status,
  }
}
