import type { ClockOptions } from '@/widgets/Clock/definition'
import type { WeatherOptions } from '@/widgets/Weather/definition'
import type { AnyWidgetDefinition } from '@/widgetSystem/registry'

/**
 * What is stored in `sync:layout`: the Layout, the same on every device (see CONTEXT.md). One
 * item for the whole Layout, so every save is atomic. v0.2.3 never reads it.
 */
export type StoredLayout = {
  /** The shape's version. A device never saves over a higher one (see storage/guard). */
  v: 1
  /** Options an update kept for the first Clock or Weather added; each is removed once used. */
  waiting?: WaitingOptions
  /** In no order: a Widget's place is its `col` and `row`, not its position in the list. */
  widgets: PlacedWidget[]
}

/** A Widget on the Grid. Columns and rows count from 1, as CSS grid lines do. */
export type PlacedWidget = {
  /** From the left: 1 to 12. */
  col: number
  /** Rows tall. */
  h: number
  /** Random, eight characters, unique within the Layout: see `newId`. */
  id: string
  /** As stored, which may hold keys this version does not know: `readOptions` makes what is drawn. */
  options: Record<string, unknown>
  /** From the top: 1 to 8. */
  row: number
  /** The Widget's `type`. One this version does not know is kept as it is. */
  type: string
  /** Columns wide. */
  w: number
}

/** The options an update kept for the first Clock or Weather added. */
export type WaitingOptions = { clock?: ClockOptions; weather?: WeatherOptions }

/**
 * A Layout as the page holds it: what is stored, with each Widget matched to its definition.
 * Everything a version does not understand is in here as it was stored, so that saving the
 * Layout writes it back unchanged.
 */
export type Layout = {
  /** Top-level keys this version does not know, kept. */
  extra: Record<string, unknown>
  waiting?: WaitingOptions
  /** In the stored order. */
  widgets: LayoutWidget[]
}

/** A Widget this version knows. */
export type KnownWidget = {
  definition: AnyWidgetDefinition
  kind: 'known'
  /**
   * What the Widget draws: its stored options checked by its definition. Options that fail the
   * check are drawn as the Widget's defaults, while `placed.options` stays as it was stored.
   */
  options: Record<string, unknown>
  placed: PlacedWidget
}

/** A Widget whose type this version does not know. Kept, and saved back as it was. */
export type UnknownWidget = {
  kind: 'unknown'
  placed: PlacedWidget
}

/**
 * Something in `widgets` that is not a Widget this version can place: no id, a place that is
 * not whole cells, an id already taken. It is not drawn, and is saved back exactly as it was.
 */
export type MalformedWidget = {
  kind: 'malformed'
  raw: unknown
}

export type LayoutWidget = KnownWidget | MalformedWidget | UnknownWidget
