import type { KnownWidget, Layout, LayoutWidget, PlacedWidget, StoredLayout } from './types'

/**
 * The example in LR-15: an updated user who had the Clock on and Weather on for Victoria, as
 * stored. It is 480 of the 8,192 bytes one synced item may hold.
 */
export const EXAMPLE_LAYOUT_JSON =
  '{"v":1,"widgets":[{"id":"k3f9x2ma","type":"clock","col":5,"row":4,"w":4,"h":2,"options":{"showDate":false,"showSeconds":false}},{"id":"p8d1q7zt","type":"weather","col":11,"row":1,"w":2,"h":1,"options":{"fields":[{"id":"highLow","shown":true},{"id":"location","shown":false},{"id":"sun","shown":false},{"id":"condition","shown":false},{"id":"feelsLike","shown":false}],"followDevice":false,"place":{"latitude":48.43,"longitude":-123.37,"name":"Victoria"},"unit":"celsius"}}]}'

export const exampleLayout = (): StoredLayout => JSON.parse(EXAMPLE_LAYOUT_JSON) as StoredLayout

/** The bytes a browser counts for an item: its key and its JSON, in UTF-8. */
export const syncBytes = (key: string, value: unknown): number =>
  new TextEncoder().encode(key + JSON.stringify(value)).length

/** The Widget at `index` of a Layout (fails the test when there is none). */
export function widgetAt(layout: Layout, index: number): LayoutWidget {
  const widget = layout.widgets[index]
  if (!widget) throw new Error(`no Widget at ${index}`)
  return widget
}

/** The Widget at `index` of a Layout, which must be one this version knows. */
export function knownAt(layout: Layout, index: number): KnownWidget {
  const widget = widgetAt(layout, index)
  if (widget.kind !== 'known') throw new Error(`the Widget at ${index} is ${widget.kind}`)
  return widget
}

/** The Widget at `index` of what is stored (fails the test when there is none). */
export function storedAt(stored: StoredLayout, index: number): PlacedWidget {
  const widget = stored.widgets[index]
  if (!widget) throw new Error(`no stored Widget at ${index}`)
  return widget
}
