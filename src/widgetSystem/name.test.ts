import { describe, expect, it } from 'vitest'

import { EXAMPLE_SIZES } from '@/test/fixtures'

import type { WidgetDefinition } from './definition'
import { accessibleName } from './name'

type Options = { place: string }

/** A Widget made up here that gives the summary it is told to. */
const example = (summary?: WidgetDefinition<Options>['summary']): WidgetDefinition<Options> => ({
  name: 'Example',
  options: [],
  sizes: EXAMPLE_SIZES,
  summary,
  type: 'example',
  View: () => null,
})

describe('accessibleName', () => {
  it("is the Widget's name when its definition gives no summary", () => {
    expect(accessibleName(example(), { place: 'Victoria' })).toBe('Example')
  })

  it('adds the summary after a comma', () => {
    expect(
      accessibleName(
        example((o) => o.place),
        { place: 'Victoria' },
      ),
    ).toBe('Example, Victoria')
  })

  it('is just the name when the summary has nothing to say', () => {
    expect(
      accessibleName(
        example(() => undefined),
        { place: 'Victoria' },
      ),
    ).toBe('Example')
    expect(
      accessibleName(
        example(() => ''),
        { place: 'Victoria' },
      ),
    ).toBe('Example')
    expect(
      accessibleName(
        example(() => '   '),
        { place: 'Victoria' },
      ),
    ).toBe('Example')
  })

  it('trims the summary', () => {
    expect(
      accessibleName(
        example(() => '  Victoria '),
        { place: '' },
      ),
    ).toBe('Example, Victoria')
  })

  it('gives the summary the options it was asked about', () => {
    const seen: Options[] = []
    accessibleName(
      example((options) => {
        seen.push(options)
        return undefined
      }),
      { place: 'Nanaimo' },
    )
    expect(seen).toEqual([{ place: 'Nanaimo' }])
  })
})
