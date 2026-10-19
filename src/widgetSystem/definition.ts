import type { ComponentType } from 'preact'

import type { Place } from '@/settings/schema'

import type { Need } from './needs'

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
}

/** On or off. */
export type SwitchOption = OptionBase & {
  control: 'switch'
  default: boolean
  shared?: never
}

/** One of the listed values. */
export type ChoiceOption = OptionBase & {
  choices: readonly { label: string; value: string }[]
  control: 'choice'
  default: string
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
  shared: PageValueName
}

/** One option, described as data. The controls are a fixed set; new kinds join it. */
export type OptionDescription =
  ChoiceOption | OrderedListOption | PageValueOption | PlaceOption | SwitchOption

export type WidgetViewProps<O> = {
  options: O
  page: PageValues
}

/** What a Widget declares. */
export type WidgetDefinition<O> = {
  /** What people read: "Weather". Free to change. */
  name: string
  /**
   * What must be true before the Widget shows, checked in order against its options. Until they
   * all are, it draws nothing. Defined once, not rebuilt on each render.
   */
  needs?: readonly Need<O>[]
  options: readonly OptionDescription[]
  /** The id that is stored. Never renamed or reused. */
  type: string
  View: ComponentType<WidgetViewProps<O>>
}
