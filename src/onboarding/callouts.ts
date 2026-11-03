import type { SectionId } from '@/components/SettingsPanel/SettingsPanel'
import type { Settings } from '@/settings/schema'

import type { CalloutTarget } from './target'

type CalloutBase = {
  /** Whether the feature can be used at all right now. Checked once, before the note is shown. */
  available?: () => Promise<boolean>
  body: string
  /** Stored once dismissed, so never reuse one. */
  id: string
  /** False once there is nothing left to point out, such as a widget already switched on. */
  relevant?: (settings: Settings) => boolean
  title: string
}

/**
 * A short note about one part of the settings, drawn by components/Callout: a stop on the
 * settings panel's own tour, or news of something to set up there. It sits where the
 * `callout--<section>` rule in style.css puts it.
 */
export type SettingsStop = CalloutBase & {
  /** The settings section it is about. */
  section: SectionId
  target?: undefined
}

/**
 * A short note about something on the page itself, such as the Edit button or a Widget: placed
 * beside it by script, with a pointer at it, so it follows the thing if it moves (see
 * `CalloutTarget` and components/Callout). It needs no rule in style.css. Not drawn while its
 * target is not on the page; a news item that cannot be drawn is not used up, and holds the
 * ones behind it back (like one that is `available`), so that they keep their order.
 */
export type PageCallout = CalloutBase & {
  section?: undefined
  target: CalloutTarget
}

export type CalloutInfo = PageCallout | SettingsStop

/**
 * The tour a new install is offered after the welcome: one stop per settings section, in order.
 * The Clock and the Weather have none: their options are on the widgets, and a tour of editing
 * is a later change.
 */
export const TOUR: readonly SettingsStop[] = [
  {
    body: 'Choose how often the photo changes, and which tags to draw from. Or pick one from the gallery to keep.',
    id: 'tour-photos',
    section: 'photos',
    title: 'Photos',
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
 *
 * There are none at the moment. The Weather's, "New: weather", opened a settings tab that is gone
 * now the Weather's options are on the widget, so it was removed; its id stays in the `dismissed`
 * list of anyone who saw it, and harms nothing there. Do not reuse `weather` as an id.
 */
export const NEWS: readonly CalloutInfo[] = []
