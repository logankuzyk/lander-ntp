import { describe, expect, it } from 'vitest'

import type { WidgetDefinition } from './definition'
import { defaultOptions, readOptions } from './options'

/** A Widget with one option of every control, made up for these tests. */
const definition: WidgetDefinition<Record<string, unknown>> = {
  name: 'Example',
  options: [
    { control: 'switch', default: true, id: 'flag', label: 'Flag' },
    {
      choices: [
        { label: 'Small', value: 'small' },
        { label: 'Large', value: 'large' },
      ],
      control: 'choice',
      default: 'small',
      id: 'size',
      label: 'Size',
    },
    {
      control: 'place',
      default: { followDevice: false, place: null },
      id: 'place',
      label: 'Place',
    },
    {
      control: 'orderedList',
      default: [
        { id: 'a', shown: true },
        { id: 'b', shown: false },
        { id: 'c', shown: false },
      ],
      id: 'rows',
      items: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      label: 'Rows',
    },
    { control: 'switch', id: 'hour12', label: '24-hour time', shared: 'hour12' },
  ],
  type: 'example',
  View: () => null,
}

describe('defaultOptions', () => {
  it('gives every option its default, a place as its two keys, and leaves out shared ones', () => {
    expect(defaultOptions(definition)).toEqual({
      flag: true,
      followDevice: false,
      place: null,
      rows: [
        { id: 'a', shown: true },
        { id: 'b', shown: false },
        { id: 'c', shown: false },
      ],
      size: 'small',
    })
  })

  it('gives a copy each time, so changing one leaves the next alone', () => {
    const first = defaultOptions(definition)
    ;(first.rows as { shown: boolean }[])[0]!.shown = false

    expect((defaultOptions(definition).rows as { shown: boolean }[])[0]?.shown).toBe(true)
  })
})

const VICTORIA = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

const stored = {
  flag: false,
  followDevice: false,
  place: VICTORIA,
  rows: [
    { id: 'c', shown: true },
    { id: 'a', shown: false },
    { id: 'b', shown: true },
  ],
  size: 'large',
}

/** The stored options with some keys missing. */
const without = (options: typeof stored, ...keys: string[]) =>
  Object.fromEntries(Object.entries(options).filter(([key]) => !keys.includes(key)))

describe('readOptions', () => {
  it('reads options that are all valid as they are', () => {
    expect(readOptions(definition, stored)).toEqual(stored)
  })

  it('gives a missing key its default and keeps the rest', () => {
    const withoutFlag = without(stored, 'flag')
    const withoutRowsAndSize = without(stored, 'rows', 'size')

    expect(readOptions(definition, withoutFlag)).toEqual({ ...stored, flag: true })
    expect(readOptions(definition, withoutRowsAndSize)).toEqual({
      ...stored,
      rows: defaultOptions(definition).rows,
      size: 'small',
    })
  })

  it('gives a place its two keys one at a time', () => {
    const withoutFollow = without(stored, 'followDevice')
    const withoutPlace = without(stored, 'place')

    expect(readOptions(definition, withoutFollow)).toEqual({ ...stored, followDevice: false })
    expect(readOptions(definition, withoutPlace)).toEqual({ ...stored, place: null })
  })

  it('gives everything its defaults when nothing is stored, or what is stored is not an object', () => {
    for (const nothing of [undefined, null, 'clock', 3, [], [stored]]) {
      expect(readOptions(definition, nothing)).toEqual(defaultOptions(definition))
    }
  })

  it('gives the whole Widget its defaults when a key holds a bad value', () => {
    const bad: Record<string, unknown>[] = [
      { flag: 'yes' },
      { size: 'huge' },
      { size: 3 },
      { place: 'Victoria' },
      { place: { latitude: 48.43, longitude: -123.37 } },
      { place: { latitude: '48.43', longitude: -123.37, name: 'Victoria' } },
      { followDevice: 1 },
      { rows: 'a b c' },
      {
        rows: [
          { id: 'a', shown: 'yes' },
          { id: 'b', shown: true },
          { id: 'c', shown: true },
        ],
      },
    ]
    for (const change of bad) {
      expect(readOptions(definition, { ...stored, ...change })).toEqual(defaultOptions(definition))
    }
  })

  it('gives the whole Widget its defaults when an ordered list does not hold each item once', () => {
    const [a, b, c] = stored.rows
    for (const rows of [[a, b], [a, a, b], [a, b, c, a], [a, b, { id: 'z', shown: true }], []]) {
      expect(readOptions(definition, { ...stored, rows })).toEqual(defaultOptions(definition))
    }
  })

  it('keeps keys it does not know, valid or not, as they are', () => {
    const unknown = { added: { by: 'a newer device' }, count: 2 }

    expect(readOptions(definition, { ...stored, ...unknown })).toEqual({ ...stored, ...unknown })
    expect(readOptions(definition, { ...unknown, flag: 'yes' })).toEqual({
      ...defaultOptions(definition),
      ...unknown,
    })
  })

  it('never reads a shared option from what is stored', () => {
    expect(readOptions(definition, { ...stored, hour12: true })).toEqual(stored)
    expect(readOptions(definition, { ...stored, hour12: 'maybe' })).toEqual(stored)
  })

  it('does not write: what is stored is left as it was', () => {
    const before = structuredClone({ ...stored, added: 1 })
    const given = { ...stored, added: 1 }
    readOptions(definition, given)

    expect(given).toEqual(before)
  })

  it('does not share its lists with what is stored', () => {
    const result = readOptions(definition, stored)

    expect(result.rows).not.toBe(stored.rows)
  })
})
