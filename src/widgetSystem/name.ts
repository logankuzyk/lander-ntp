import type { DefinitionOf } from './definition'

/**
 * What a Widget's box is called to a screen reader, and what its frame says in edit mode: the
 * definition's `name`, then its `summary` of the options when it gives one ("Weather, Victoria"),
 * so that two of the same type can be told apart. `options` are the options as the definition
 * reads them (see `readOptions`).
 *
 * It follows the options and nothing else. A name that followed what the Widget shows, such as
 * the Clock's time, would change as often as that does.
 */
export function accessibleName<O>(definition: DefinitionOf<O>, options: O): string {
  const summary = definition.summary?.(options)?.trim()
  return summary ? `${definition.name}, ${summary}` : definition.name
}
