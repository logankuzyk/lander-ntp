import type { PageValues, WidgetDefinition, WidgetSource, WidgetViewProps } from './definition'
import { useUnmetNeed } from './needs'
import { readOptions } from './options'
import { useSource } from './source'

type WidgetHostProps<O, R, C> = {
  definition: WidgetDefinition<O, R, C>
  /** What is stored for this Widget, which may be missing or wrong; the definition reads it. */
  options: unknown
  page: PageValues
}

type SourcedViewProps<O, R, C> = {
  options: O
  page: PageValues
  source: WidgetSource<O, R, C>
  View: WidgetDefinition<O, R, C>['View']
}

/**
 * Runs the Widget's source and draws its View with the reading, or nothing while there is none.
 * A component of its own so that none of this starts before the needs are met: hooks cannot be
 * called conditionally, but a component can be left out.
 */
function SourcedView<O, R, C>({ options, page, source, View }: SourcedViewProps<O, R, C>) {
  const { context, query } = source.useQuery(options)
  const reading = useSource(source.source, query)
  if (reading === null) return null
  return <View context={context} options={options} page={page} reading={reading} />
}

/**
 * Draws a Widget: its View, with its options read from what is stored and the page's values.
 * Nothing is drawn while its needs are being checked or one is unmet. A Widget with a source
 * has it run once every need is met, and is drawn only with a reading.
 *
 * It adds no element of its own. `.app` is a grid that centres its children, so a wrapper
 * would be a row of its own and move the Widget.
 */
export function WidgetHost<O, R, C>({ definition, options, page }: WidgetHostProps<O, R, C>) {
  const { source, View } = definition
  const read = readOptions(definition, options)
  const unmet = useUnmetNeed(definition.needs, read)
  if (unmet !== null) return null
  if (source) return <SourcedView options={read} page={page} source={source} View={View} />
  // No source, so no reading or context: they are the `undefined` that `R` and `C` default to.
  const props = { options: read, page } as WidgetViewProps<O, R, C>
  return <View {...props} />
}
