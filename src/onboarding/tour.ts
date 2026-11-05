import { type PageState, type SettingsStop, TOUR, type TourStop } from './callouts'
import type { CalloutTarget } from './target'

/** What the page has, which decides the stops of its tour. */
export type PageFacts = {
  /** The target of the first item in the Add menu, such as `menu:clock`; null if it has none. */
  menu: CalloutTarget | null
  /** Whether a Widget is waiting for the person to set it up (it shows a setup button). */
  setup: boolean
  /** The target of the first Widget on the page, such as `widget:clock`; null for an empty Grid. */
  widget: CalloutTarget | null
}

/** A stop on the page, ready to draw: its target is a real one. */
export type PlannedStop = {
  body: string
  id: string
  /** Where it is in the whole tour, counting the settings panel's stops: "3 of 7". */
  number: number
  /** What the page is doing while it is up. */
  show: PageState
  target: CalloutTarget
  title: string
}

export type TourPlan = {
  page: PlannedStop[]
  /** The stops the settings panel draws itself, after the last one on the page. */
  settings: SettingsStop[]
  /** How many stops the tour has, on the page and in the panel. */
  total: number
}

const isSettingsStop = (stop: TourStop): stop is SettingsStop => stop.section !== undefined

/** The stops the settings panel draws, in order: the last of the tour. */
export const SETTINGS_TOUR: readonly SettingsStop[] = TOUR.filter(isSettingsStop)

/**
 * The tour for a page that has `facts`. The stops about a Widget are left out of an empty Grid,
 * and the setup button has a stop only when a Widget is waiting for setup; otherwise the Add
 * stop says it in a sentence. Pure: it reads nothing from the page.
 */
export function planTour(facts: PageFacts, stops: readonly TourStop[] = TOUR): TourPlan {
  const page: PlannedStop[] = []
  for (const stop of stops) {
    if (isSettingsStop(stop)) continue
    if (stop.when === 'widget' && facts.widget === null) continue
    if (stop.when === 'setup' && !facts.setup) continue
    const target =
      stop.target === 'widget'
        ? facts.widget
        : stop.target === 'menu-item'
          ? facts.menu
          : stop.target
    if (target === null) continue
    page.push({
      body: !facts.setup && stop.unlessSetup ? `${stop.body} ${stop.unlessSetup}` : stop.body,
      id: stop.id,
      number: page.length + 1,
      show: stop.show,
      target,
      title: stop.title,
    })
  }
  const settings = stops.filter(isSettingsStop)
  return { page, settings, total: page.length + settings.length }
}
