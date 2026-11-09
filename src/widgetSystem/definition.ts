import type { ComponentType } from 'preact'

import type { Place } from '@/settings/schema'

import type { Need } from './needs'
import type { Query, Source, WatchedSource } from './source'

/**
 * The page-wide values a Widget may read: settings shared by the whole page, not kept in any
 * Widget's options. The font is not among them; it stays in CSS.
 */
export type PageValues = {
  hour12: boolean
}

/** The name of a page-wide value. */
export type PageValueName = keyof PageValues

type OptionBase = {
  id: string
  /** What people read beside the control. */
  label: string
  /**
   * The ids of the Widget's needs (see `needs`) that must be met before the control may be used,
   * for a control that would send something somewhere: until they are, the form holds it back and
   * shows the first unmet need's words and action beside it. Left out, the control is always
   * there. Each id must name one of the Widget's needs.
   */
  needs?: readonly string[]
}

/** On or off. */
export type SwitchOption = OptionBase & {
  control: 'switch'
  default: boolean
  shared?: never
}

/** Free text, kept as entered so a Widget can validate and preview it while typing. */
export type TextOption = OptionBase & {
  control: 'text'
  default: string
  placeholder?: string
}

/** Icon data, null until a user uploads one. */
export type IconOption = OptionBase & {
  control: 'icon'
  default: string | null
}

/** A six digit colour chosen with the shared Background colour picker. */
export type ColourOption = OptionBase & {
  control: 'colour'
  default: string
}

/** One of the listed values. */
export type ChoiceOption = OptionBase & {
  choices: readonly { label: string; value: string }[]
  control: 'choice'
  /** A function is evaluated when a Widget is added, so a locale-derived choice is captured. */
  default: (() => string) | string
}

/** A choice whose values come from this device when the menu opens. */
export type PickChoice = { depth?: number; label: string; value: string }

type PickOptionBase = OptionBase & {
  control: 'pick'
  emptyText: string
  failedText: string
  load: () => Promise<readonly PickChoice[]>
  /** A stored value's label when it is absent from this device's loaded list. */
  missingLabel?: (value: string) => string
  /** A label for the stored value before this device's list has loaded. */
  valueLabel?: (value: string) => string | undefined
}

/** One value from a list loaded by the Widget. */
export type PickOption = PickOptionBase & {
  default: string
  multiple?: false
}

/** Several values from a list loaded by the Widget. */
export type MultiPickOption = PickOptionBase & {
  default: readonly string[]
  multiple: true
}

/** What a place option holds. */
export type PlaceValue = {
  followDevice: boolean
  place: Place | null
}

/**
 * A place, or the device's own position: "Current location" is an entry in the place search,
 * so the two go together. Stored as two keys, `place` and `followDevice`, whatever the option's
 * `id`.
 */
export type PlaceOption = OptionBase & {
  control: 'place'
  default: PlaceValue
  id: 'place'
}

/** One entry of an ordered list: shown, or hidden. */
export type ListEntry = { id: string; shown: boolean }

/** Every listed id exactly once, in the order to draw them, each shown or hidden. */
export type OrderedListOption = OptionBase & {
  control: 'orderedList'
  default: readonly ListEntry[]
  /** The ids the list holds, with what to call each. */
  items: readonly { id: string; label: string }[]
}

/**
 * A switch backed by a page-wide value instead of the Widget's own. The form shows it like any
 * other control and a change there changes it for every Widget. It has no default, and is
 * never stored in the Widget's options.
 */
export type PageValueOption = OptionBase & {
  control: 'switch'
  default?: never
  /**
   * The switch says the opposite of the value: "24-hour time" is on when `hour12` is off. The
   * form that draws it inverts the value on the way in and the change on the way out.
   */
  invert?: boolean
  shared: PageValueName
}

/** One option, described as data. The controls are a fixed set; new kinds join it. */
export type OptionDescription =
  | ChoiceOption
  | ColourOption
  | IconOption
  | MultiPickOption
  | OrderedListOption
  | PageValueOption
  | PickOption
  | PlaceOption
  | SwitchOption
  | TextOption

/** A size on the Grid, in whole cells. */
export type Cells = { h: number; w: number }

/**
 * The sizes a Widget may have, in cells. Any whole number of cells between `smallest` and
 * `largest` is allowed, and the Widget's content fills whatever box it is given.
 */
export type WidgetSizes<O> = {
  /** The most it may be resized to. */
  largest: Cells
  /** The least it may be resized to; may depend on which options are on. */
  smallest: ((options: O) => Cells) | Cells
  /** Where it starts when added, which may depend on the options. Between smallest and largest. */
  starting: (options: O) => Cells
}

/** The least size for these options; most Widgets keep one fixed size. */
export function smallestSize<O>(sizes: WidgetSizes<O>, options: O): Cells {
  return typeof sizes.smallest === 'function' ? sizes.smallest(options) : sizes.smallest
}

/**
 * What a View is given. A Widget with a source also gets the `reading` the source loaded and
 * the `context` its `useQuery` carried along; for one without, both are undefined.
 */
export type WidgetViewProps<O, R = undefined, C = undefined> = {
  /** The whole cells the Grid draws this Widget in. */
  cells: Cells
  context: C
  options: O
  page: PageValues
  reading: R
}

/** What `useQuery` gives: what to load, and anything else the View needs from working that out. */
export type SourceQuery<R, C> = {
  /** Handed to the View with the reading. */
  context: C
  /** Null while there is nothing to load yet. */
  query: Query<R> | null
}

/** Where a Widget's data comes from, and what to ask of it for these options. */
export type TimedWidgetSource<O, R, C> = {
  /** Left out for existing timed Sources; a new declaration may say it explicitly. */
  kind?: 'timed'
  source: Source<R>
  /**
   * Works out what to load from the options. A hook, so it can follow things that change on
   * their own, such as the device's position. It runs only once every need is met, so it may
   * start work (ask the device, fetch a name) that the needs are there to hold back.
   */
  useQuery: (options: O) => SourceQuery<R, C>
}

/** A Source that reads local data again when its watch says that data changed. */
export type WatchedWidgetSource<O, R> = {
  kind: 'watched'
  source: WatchedSource<R, O>
}

export type WidgetSource<O, R, C> = TimedWidgetSource<O, R, C> | WatchedWidgetSource<O, R>

/** A line of thanks that links to where the Widget's data comes from. */
export type Credit = {
  href: string
  text: string
}

/**
 * The one line the box says in place of a Widget that has nothing to show: while it loads,
 * when it cannot, and when its source is switched off. Any left out use the shared words.
 */
export type StateMessages = {
  failed?: string
  loading?: string
  off?: string
}

/**
 * What a Widget declares. `R` is what its source loads and `C` what the source carries to the
 * View. Both are only for definitions with a `source`; a Widget without one leaves them alone.
 */
export type WidgetDefinition<O, R = undefined, C = undefined> = {
  /** A line at the foot of its options, such as who its data is from. */
  credit?: Credit
  /**
   * The words for the box's loading, failed and switched-off states, for a Widget with a
   * source. See `StateMessages`.
   */
  messages?: StateMessages
  /** What people read: "Weather". Free to change. */
  name: string
  /**
   * What must be true before the Widget shows, checked in order against its options. Until they
   * all are, it draws nothing. Defined once, not rebuilt on each render.
   */
  needs?: readonly Need<O>[]
  /** Called when a removed Widget’s Undo notice expires or is dismissed. */
  onDiscard?: (options: Record<string, unknown>) => void
  options: readonly OptionDescription[]
  /** How big it may be on the Grid, and how big it starts. */
  sizes: WidgetSizes<O>
  /**
   * Where its data comes from. Run once every need is met; the View is drawn only with a
   * reading, and without one the box says why (see `messages`). Defined once, not rebuilt on
   * each render.
   */
  source?: WidgetSource<O, R, C>
  /**
   * A few words from the options that tell one Widget of this type from another, such as the
   * Weather's place. The box's accessible name is `name`, a comma and this ("Weather,
   * Victoria"). Nothing, or an empty string, leaves the name alone. It must not follow what the
   * Widget shows (the Clock's time would change every second), only the options.
   */
  summary?: (options: O) => string | undefined
  /** The id that is stored. Never renamed or reused. */
  type: string
  /** Why this Widget cannot be added in this browser, checked by the Add menu. */
  unavailable?: () => string | null
  View: ComponentType<WidgetViewProps<O, R, C>>
}

/**
 * A definition with options `O`, whatever it loads. `WidgetDefinition` is invariant in what it
 * loads (a View takes it, a source gives it), so only an `any` stands for all of them; this is
 * the one place that says so, for what only reads the options.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DefinitionOf<O> = WidgetDefinition<O, any, any>
