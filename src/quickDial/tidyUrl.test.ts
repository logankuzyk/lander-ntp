import { describe, expect, it } from 'vitest'

import { tidyUrl } from './tidyUrl'

describe('tidyUrl', () => {
  it.each([
    ['github.com', 'https://github.com/'],
    ['http://example.com', 'http://example.com/'],
    ['HTTPS://Example.com/x', 'https://example.com/x'],
    ['localhost:3000', null],
    ['javascript:alert(1)', null],
    ['data:text/html,x', null],
    ['ftp://x', null],
    ['', null],
    ['   ', null],
    ['https://münich.example', 'https://xn--mnich-kva.example/'],
  ])('normalizes %s', (input, expected) => {
    expect(tidyUrl(input)).toBe(expected)
  })
})
