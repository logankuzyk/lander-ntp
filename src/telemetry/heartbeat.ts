import { favouritesItem } from '@/favourites/storage'
import type { Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { track } from './client'
import type { HeartbeatProps } from './events'
import { lastHeartbeat } from './storage'

export const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Due a day after the last one, or straight away if the clock has gone back past it. */
export const isHeartbeatDue = (last: number | null, now: number): boolean =>
  last === null || now - last >= HEARTBEAT_INTERVAL_MS || now < last

export const heartbeatProps = (settings: Settings, favouritesCount: number): HeartbeatProps => ({
  frequency: settings.frequency,
  font: settings.font,
  dim: settings.dim,
  clock: {
    enabled: settings.clock.enabled,
    hour12: settings.clock.hour12,
    showDate: settings.clock.showDate,
    showSeconds: settings.clock.showSeconds,
  },
  favourites: {
    enabled: settings.favourites.enabled,
    style: settings.favourites.style,
    size: settings.favourites.size,
    count: favouritesCount,
  },
})

/**
 * Report this install as active, at most once a day: the first new tab after that sends it.
 * Claimed before sending, so a failed send waits for tomorrow rather than retrying on every
 * tab. Tabs that race (a restored session) may each send one; reports count distinct installs.
 */
export async function maybeSendHeartbeat(now = Date.now()): Promise<void> {
  if (!isHeartbeatDue(await lastHeartbeat.getValue(), now)) return
  await lastHeartbeat.setValue(now)

  const [settings, favourites] = await Promise.all([
    settingsItem.getValue(),
    favouritesItem.getValue(),
  ])
  await track({ event: 'heartbeat', props: heartbeatProps(settings, favourites.length) })
}
