import { afterEach, describe, expect, it, vi } from 'vitest'

import { newId } from './id'

afterEach(() => vi.restoreAllMocks())

/** Makes each call of `crypto.getRandomValues` fill its array from the next row of bytes. */
const randomBytes = (...rows: number[][]) => {
  const spy = vi.spyOn(crypto, 'getRandomValues')
  rows.forEach((row) =>
    spy.mockImplementationOnce(<T extends ArrayBufferView | null>(array: T): T => {
      new Uint8Array((array as unknown as Uint8Array).buffer).set(row)
      return array
    }),
  )
}

const repeat = (byte: number, times = 16) => Array.from({ length: times }, () => byte)

describe('newId', () => {
  it('is eight lowercase letters and digits', () => {
    for (let i = 0; i < 50; i++) expect(newId([])).toMatch(/^[a-z0-9]{8}$/)
  })

  it('is not one of the ids it is given', () => {
    // Byte 0 is "a" and byte 1 is "b": the first draw is "aaaaaaaa", which is taken.
    randomBytes(repeat(0), repeat(1))

    expect(newId(['aaaaaaaa'])).toBe('bbbbbbbb')
  })

  it('gives every character the same chance: bytes that would favour some are skipped', () => {
    // 36 characters do not divide 256 evenly. A byte of 252 or more would make the first four
    // characters likelier than the rest, so those are skipped and the next byte is used.
    randomBytes([252, 253, 254, 255, 0, 1, 2, 3, 4, 5, 6, 7, 255, 255, 255, 255])

    expect(newId([])).toBe('abcdefgh')
  })

  it('draws again when too few bytes were usable', () => {
    randomBytes(repeat(255), [35, 34, 33, 32, 31, 30, 29, 28, ...repeat(255, 8)])

    expect(newId([])).toBe('98765432')
  })

  it('does not repeat across many draws against the ids already made', () => {
    const made: string[] = []
    for (let i = 0; i < 500; i++) made.push(newId(made))

    expect(new Set(made).size).toBe(500)
  })
})
