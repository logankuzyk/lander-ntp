import * as v from 'valibot'

import type { DefinitionOf, OptionDescription } from './definition'

const PlaceSchema = v.nullable(
  v.looseObject({ latitude: v.number(), longitude: v.number(), name: v.string() }),
)

/** One thing to store: the key it is stored under, what it starts as, and what it must be. */
type Field = {
  default: unknown
  key: string
  schema: v.GenericSchema
}

/** The fields an option is stored as: a place takes two, a shared option none. */
function fieldsOf(option: OptionDescription): Field[] {
  if ('shared' in option) return []
  switch (option.control) {
    case 'choice':
      return [
        {
          default: option.default,
          key: option.id,
          schema: v.picklist(option.choices.map((choice) => choice.value)),
        },
      ]
    case 'orderedList': {
      const ids = option.items.map((item) => item.id)
      return [
        {
          default: option.default,
          key: option.id,
          schema: v.pipe(
            v.array(v.looseObject({ id: v.picklist(ids), shown: v.boolean() })),
            // Each item exactly once: the form has a row for every one.
            v.check(
              (list) =>
                list.length === ids.length && new Set(list.map(({ id }) => id)).size === ids.length,
            ),
          ),
        },
      ]
    }
    case 'place':
      return [
        {
          default: option.default.place,
          key: 'place',
          schema: PlaceSchema,
        },
        { default: option.default.followDevice, key: 'followDevice', schema: v.boolean() },
      ]
    case 'switch':
      return [{ default: option.default, key: option.id, schema: v.boolean() }]
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const defaultsOf = (fields: readonly Field[]): Record<string, unknown> =>
  Object.fromEntries(fields.map((field) => [field.key, structuredClone(field.default)]))

/**
 * A Widget's options as a new Widget starts: every option at its default, under the key it is
 * stored under. Shared options are the page's, not the Widget's, so they are not here.
 */
export function defaultOptions<O>(definition: DefinitionOf<O>): O {
  return defaultsOf(definition.options.flatMap(fieldsOf)) as O
}

/**
 * The keys of what is stored that this version knows nothing of, copied: the options a shared
 * option's name or a field's key does not account for.
 */
function unknownKeys(
  descriptions: readonly OptionDescription[],
  fields: readonly Field[],
  given: Record<string, unknown>,
): Record<string, unknown> {
  const known = new Set([
    ...fields.map((field) => field.key),
    ...descriptions.filter((option) => 'shared' in option).map((option) => option.id),
  ])
  return Object.fromEntries(
    Object.entries(given)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => [key, structuredClone(value)]),
  )
}

/**
 * The options a Widget shows, from whatever is stored for it. Pure: nothing is written back.
 *
 * - A key that is missing gets its default, so an option added later needs no migration.
 * - A key that is present but wrong gives the whole Widget its defaults, and nothing outside
 *   this Widget is affected.
 * - Keys it does not know are kept as they are, so a newer version's survive being saved here.
 * - A shared option is the page's: whatever is stored under its name is ignored and dropped.
 *
 * What is stored is not an object at all: the defaults.
 */
export function readOptions<O>(definition: DefinitionOf<O>, stored: unknown): O {
  const fields = definition.options.flatMap(fieldsOf)
  const given = isRecord(stored) ? stored : {}

  const unknown = unknownKeys(definition.options, fields, given)

  const read: Record<string, unknown> = {}
  for (const field of fields) {
    if (!(field.key in given)) {
      read[field.key] = structuredClone(field.default)
      continue
    }
    const result = v.safeParse(field.schema, given[field.key])
    if (!result.success) return { ...unknown, ...defaultsOf(fields) } as O
    read[field.key] = result.output
  }
  return { ...unknown, ...read } as O
}

/**
 * What to store for a Widget when the user changes some of its options: the whole object, so
 * each change is one save. Unlike reading, which draws a Widget with a bad key from its defaults
 * and leaves what is stored alone, this is the user changing this Widget's options on this
 * device, which is when stored options may be put right (LR-15):
 *
 * - Keys it does not know are kept as they are, so a newer version's survive being saved here.
 * - A key that passes its check is kept as stored.
 * - A key that is missing, or fails its check, is replaced by its default; no other key is.
 * - A shared option is the page's: whatever is stored under its name is dropped.
 * - Then the change is laid over all that, a place by both its keys at once.
 *
 * Pure: nothing is written, and the result shares nothing with what is stored.
 */
export function writeOptions<O>(
  definition: DefinitionOf<O>,
  stored: unknown,
  change: Partial<O>,
): Record<string, unknown> {
  const fields = definition.options.flatMap(fieldsOf)
  const given = isRecord(stored) ? stored : {}

  const kept: Record<string, unknown> = {}
  for (const field of fields) {
    const result = field.key in given ? v.safeParse(field.schema, given[field.key]) : null
    kept[field.key] = result?.success ? result.output : structuredClone(field.default)
  }
  return { ...unknownKeys(definition.options, fields, given), ...kept, ...structuredClone(change) }
}
