import type { Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { track } from './client'
import { isTelemetryEnabled } from './consent'
import type { HeartbeatProps } from './events'
import { lastHeartbeat } from './storage'

const DAY_MS = 24 * 60 * 60 * 1000

/** Days since the epoch, in UTC: the day Analytics Engine queries bucket a heartbeat into. */
const utcDay = (ms: number): number => Math.floor(ms / DAY_MS)

/**
 * Due on a new UTC day, or straight away if the clock has gone back past the last one.
 * Calendar days rather than 24 hours since the last send, which would push each send a
 * little later than the one before and miss days for someone who opens a tab every day.
 */
export const isHeartbeatDue = (last: number | null, now: number): boolean =>
  last === null || now < last || utcDay(now) !== utcDay(last)

export const heartbeatProps = (settings: Settings): HeartbeatProps => ({
  photos: {
    mode: settings.photos.mode,
    frequency: settings.photos.frequency,
    tags: settings.photos.tags.length,
  },
  font: settings.font,
  dim: settings.dim,
  clock: {
    enabled: settings.clock.enabled,
    hour12: settings.clock.hour12,
    showDate: settings.clock.showDate,
    showSeconds: settings.clock.showSeconds,
  },
})

/** Take today's heartbeat for this tab, if no other tab has. Resolves to whether it did. */
async function claimHeartbeat(now: number): Promise<boolean> {
  const claim = async () => {
    if (!isHeartbeatDue(await lastHeartbeat.getValue(), now)) return false
    await lastHeartbeat.setValue(now)
    return true
  }
  // New tabs opened together (a restored session) would otherwise all read the old value
  // before any of them wrote, and each send one. Extension pages share an origin, so the lock
  // holds across them. Without the Locks API (tests), claim unguarded.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('heartbeat', claim)
    : claim()
}

/**
 * Report this install as active, at most once a (UTC) day: the first new tab of the day sends
 * it. Only claimed once telemetry is known to be on, so switching it back on sends that day
 * rather than the next. Claimed before sending, so a failed send waits for tomorrow rather
 * than retrying on every tab.
 */
export async function maybeSendHeartbeat(now = Date.now()): Promise<void> {
  const settings = await settingsItem.getValue()
  if (!(await isTelemetryEnabled(settings))) return
  if (!(await claimHeartbeat(now))) return

  await track({ event: 'heartbeat', props: heartbeatProps(settings) })
}
