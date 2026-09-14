import type { Frequency } from '@/photos/rotation'

import type { FontId } from './fonts'

export type Settings = {
  /** How often the photo changes. */
  frequency: Frequency
  clock: {
    enabled: boolean
    hour12: boolean
    showDate: boolean
    showSeconds: boolean
  }
  font: FontId
  /** Lay a slight wash over the photo, so light text holds up over bright ones. */
  dim: boolean
  favourites: {
    enabled: boolean
    style: 'list' | 'grid'
    size: 's' | 'm' | 'l'
  }
  widgets: {
    /** Location and the link back to logankuzyk.com. */
    credit: boolean
    /** EXIF panel. */
    info: boolean
  }
}

/** Whether this browser's locale writes times as 12-hour. */
const localeUsesHour12 = (): boolean =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false

export const DEFAULT_SETTINGS: Settings = {
  frequency: 'every-visit',
  clock: {
    enabled: true,
    hour12: localeUsesHour12(),
    showDate: false,
    showSeconds: false,
  },
  font: 'system',
  dim: true,
  favourites: {
    // Off until there is something to show: an empty favourites bar is just a gap.
    enabled: false,
    style: 'list',
    size: 'm',
  },
  widgets: {
    credit: true,
    info: true,
  },
}
