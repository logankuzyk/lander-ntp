import type { PageValues, WidgetDefinition } from './definition'
import { readOptions } from './options'

type WidgetHostProps<O> = {
  definition: WidgetDefinition<O>
  /** What is stored for this Widget, which may be missing or wrong; the definition reads it. */
  options: unknown
  page: PageValues
}

/**
 * Draws a Widget: its View, with its options read from what is stored and the page's values.
 *
 * It adds no element of its own. `.app` is a grid that centres its children, so a wrapper
 * would be a row of its own and move the Widget.
 */
export function WidgetHost<O>({ definition, options, page }: WidgetHostProps<O>) {
  const { View } = definition
  return <View options={readOptions(definition, options)} page={page} />
}
