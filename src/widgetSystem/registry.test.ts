import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'

import { widgetDefinition, WIDGETS } from './registry'

describe('the registry', () => {
  it('finds a Widget by its type', () => {
    expect(widgetDefinition('clock')).toBe(clockDefinition)
  })

  it('finds nothing for a type it does not know', () => {
    expect(widgetDefinition('weather-from-the-future')).toBeUndefined()
  })

  it('lists each type once', () => {
    const types = WIDGETS.map((definition) => definition.type)
    expect(new Set(types).size).toBe(types.length)
  })
})
