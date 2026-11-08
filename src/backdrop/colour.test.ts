import { describe, expect, it } from 'vitest'

import { parseColour } from './colour'

describe('parseColour', () => {
  it.each([
    ['1a2b3c', '#1a2b3c'],
    ['#1A2B3C', '#1A2B3C'],
    ['#ffffff', '#ffffff'],
  ])('accepts %s', (input, expected) => {
    expect(parseColour(input)).toBe(expected)
  })

  it.each(['', '12345', '1234567', '#12345g', '##123456', ' 123456'])('rejects %s', (input) => {
    expect(parseColour(input)).toBeNull()
  })
})
