import type { PhotoSettings } from '@/photos/rotation'

import type { FontId } from './fonts'

export type Settings = {
  /** Which photo is on screen, and how often it changes. */
  photos: PhotoSettings
  clock: {
    enabled: boolean
    hour12: boolean
    showDate: boolean
    showSeconds: boolean
  }
  font: FontId
  /** Lay a slight wash over the photo, so light text holds up over bright ones. */
  dim: boolean
  /** Send usage data (see src/telemetry). Firefox also asks at install. */
  telemetry: boolean
}

/** Whether this browser's locale writes times as 12-hour. */
const localeUsesHour12 = (): boolean =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false

export const DEFAULT_SETTINGS: Settings = {
  photos: {
    mode: 'cycle',
    frequency: 'every-visit',
    tags: [],
    pinnedId: null,
  },
  clock: {
    enabled: true,
    hour12: localeUsesHour12(),
    showDate: false,
    showSeconds: false,
  },
  font: 'system',
  dim: true,
  // On, with the switch in settings and a line in each store listing. Firefox users answer
  // its own prompt at install, which gates this too (see telemetry/consent).
  telemetry: true,
}
