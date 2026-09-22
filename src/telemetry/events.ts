import type { Settings } from '@/settings/schema'

/**
 * The settings a heartbeat reports, picked one by one rather than spread: a setting added
 * later (a weather location, say) must not start leaving the browser unnoticed.
 */
export type HeartbeatProps = {
  photos: {
    mode: Settings['photos']['mode']
    frequency: Settings['photos']['frequency']
    /** How many tags are being cycled. Never which ones. */
    tags: number
  }
  font: Settings['font']
  dim: boolean
  clock: Settings['clock']
}

/** Everything the extension sends. telemetry-worker/src/schema.ts accepts the same shapes. */
export type TelemetryEvent = { event: 'heartbeat'; props: HeartbeatProps }
