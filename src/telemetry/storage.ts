import { storage } from 'wxt/utils/storage'

/**
 * A random id for this install, so a day's heartbeats can be counted once each. Local rather
 * than synced: it counts browsers, not people, and goes away with the extension. It is
 * pseudonymous rather than anonymous: stable, and seen by the endpoint alongside an IP.
 */
export const installId = storage.defineItem<string>('local:telemetryId', {
  init: () => crypto.randomUUID(),
})

/** Epoch ms of the last heartbeat this install sent (or tried to). */
export const lastHeartbeat = storage.defineItem<number>('local:lastHeartbeat')
