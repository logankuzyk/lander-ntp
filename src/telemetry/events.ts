import type { Settings } from '@/settings/schema'

/**
 * The settings a heartbeat reports, picked one by one rather than spread: a setting added
 * later (a weather location, say) must not start leaving the browser unnoticed.
 */
export type HeartbeatProps = {
  frequency: Settings['frequency']
  font: Settings['font']
  dim: boolean
  clock: Settings['clock']
  favourites: Settings['favourites'] & {
    /** How many there are. Never their addresses or titles. */
    count: number
  }
}

/** Everything the extension sends. telemetry-worker/src/schema.ts accepts the same shapes. */
export type TelemetryEvent = { event: 'heartbeat'; props: HeartbeatProps }
