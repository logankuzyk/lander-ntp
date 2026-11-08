import { describe, expect, it } from 'vitest'

import { readableInk } from './readableInk'
import { BACKGROUND_COLOURS } from './storage'

describe('readableInk', () => {
  it.each([
    ['black', '#000000', '#fff'],
    ['white', '#ffffff', '#111'],
    ['mid grey', '#808080', '#111'],
    ['yellow', '#ffff00', '#111'],
  ])('chooses the higher contrast ink for %s', (_name, colour, expected) => {
    expect(readableInk(colour)).toBe(expected)
  })

  it.each([
    ['#ffffff', '#111'],
    ['#f2e8cf', '#111'],
    ['#a8dadc', '#111'],
    ['#457b9d', '#fff'],
    ['#1d3557', '#fff'],
    ['#e63946', '#111'],
    ['#f4a261', '#111'],
    ['#2a9d8f', '#111'],
  ])('chooses legible ink for preset %s', (colour, expected) => {
    expect(BACKGROUND_COLOURS).toContain(colour)
    expect(readableInk(colour)).toBe(expected)
  })
})
