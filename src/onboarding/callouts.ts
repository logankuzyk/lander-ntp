import type { SectionId } from '@/components/SettingsPanel/SettingsPanel'
import type { Settings } from '@/settings/schema'
import { getEndpoints } from '@/weather/endpoints'

/** A short note about one part of the settings, drawn by components/Callout. */
export type CalloutInfo = {
  /** Whether the feature can be used at all right now. Checked once, before the note is shown. */
  available?: () => Promise<boolean>
  body: string
  /** Stored once dismissed, so never reuse one. */
  id: string
  /** False once there is nothing left to point out, such as a widget already switched on. */
  relevant?: (settings: Settings) => boolean
  /** The settings section it is about. */
  section: SectionId
  title: string
}

/** The tour a new install is offered after the welcome: one stop per settings section, in order. */
export const TOUR: readonly CalloutInfo[] = [
  {
    body: 'Choose how often the photo changes, and which tags to draw from. Or pick one from the gallery to keep.',
    id: 'tour-photos',
    section: 'photos',
    title: 'Photos',
  },
  {
    body: 'Switch to 24-hour time, or add the date and seconds.',
    id: 'tour-clock',
    section: 'clock',
    title: 'Clock',
  },
  {
    body: 'Switch it on and pick a place to see the forecast in the top corner.',
    id: 'tour-weather',
    section: 'weather',
    title: 'Weather',
  },
  {
    body: 'Set the font for the clock and everything around it.',
    id: 'tour-general',
    section: 'general',
    title: 'Font',
  },
]

/**
 * Shown once, one at a time and in this order, to people who had the extension before the
 * feature arrived. A new install never sees these: the tour covers the same ground. To
 * announce a feature, add an entry here (and a stop in TOUR if it earns one).
 */
export const NEWS: readonly CalloutInfo[] = [
  {
    // The manifest can switch the weather off; see weather/endpoints.
    available: async () => (await getEndpoints()).enabled,
    body: 'See the forecast for a place you pick, up here.',
    id: 'weather',
    relevant: (settings) => !settings.weather.enabled,
    section: 'weather',
    title: 'New: weather',
  },
]
