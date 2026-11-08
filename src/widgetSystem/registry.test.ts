import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import { widgetDefinition, WIDGETS } from './registry'

describe('the registry', () => {
  it('finds a Widget by its type', () => {
    expect(widgetDefinition('clock')).toBe(clockDefinition)
    expect(widgetDefinition('weather')).toBe(weatherDefinition)
  })

  it('finds nothing for a type it does not know', () => {
    expect(widgetDefinition('weather-from-the-future')).toBeUndefined()
  })

  it('lists each type once', () => {
    const types = WIDGETS.map((definition) => definition.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('only has options depend on needs that the Widget has', () => {
    for (const definition of WIDGETS) {
      const needs = (definition.needs ?? []).map(({ id }) => id)
      for (const option of definition.options) {
        for (const id of option.needs ?? []) expect(needs).toContain(id)
      }
    }
  })
})
