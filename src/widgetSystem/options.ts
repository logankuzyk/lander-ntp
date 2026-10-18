import * as v from 'valibot'

import type { OptionDescription, WidgetDefinition } from './definition'

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
          default: option.default.map((entry) => ({ ...entry })),
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
          default: option.default.place && { ...option.default.place },
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
export function defaultOptions<O>(definition: WidgetDefinition<O>): O {
  return defaultsOf(definition.options.flatMap(fieldsOf)) as O
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
export function readOptions<O>(definition: WidgetDefinition<O>, stored: unknown): O {
  const fields = definition.options.flatMap(fieldsOf)
  const given = isRecord(stored) ? stored : {}

  const known = new Set([
    ...fields.map((field) => field.key),
    ...definition.options.filter((option) => 'shared' in option).map((option) => option.id),
  ])
  const unknown = Object.fromEntries(
    Object.entries(given)
      .filter(([key]) => !known.has(key))
      .map(([key, value]) => [key, structuredClone(value)]),
  )

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
