import { describe, expect, it } from 'vitest'

import {
  addFavourite,
  defaultTitle,
  makeFavourite,
  moveFavourite,
  normalizeUrl,
  removeFavourite,
  updateFavourite,
  MAX_FAVOURITES,
  type Favourite,
} from './schema'
import { favouritesItem } from './storage'

const list = (...titles: string[]): Favourite[] =>
  titles.map((title, index) => ({
    id: String(index),
    title,
    url: `https://${title.toLowerCase()}.com/`,
  }))

describe('normalizeUrl', () => {
  it.each([
    ['logankuzyk.com', 'https://logankuzyk.com/'],
    ['  example.com/photos?a=1 ', 'https://example.com/photos?a=1'],
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/x', 'https://example.com/x'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected)
  })

  it.each(['', '   ', 'not a url', 'localhost', 'javascript:alert(1)', 'file:///etc/passwd'])(
    'rejects %s',
    (input) => {
      expect(normalizeUrl(input)).toBeNull()
    },
  )
})

describe('defaultTitle', () => {
  it('uses the hostname without www', () => {
    expect(defaultTitle('https://www.logankuzyk.com/photography')).toBe('logankuzyk.com')
  })
})

describe('makeFavourite', () => {
  it('falls back to the hostname when no name is given', () => {
    expect(makeFavourite({ url: 'logankuzyk.com' }, 'id-1')).toEqual({
      id: 'id-1',
      title: 'logankuzyk.com',
      url: 'https://logankuzyk.com/',
    })
  })

  it('keeps a given name and returns null for an unusable URL', () => {
    expect(makeFavourite({ title: '  Portfolio  ', url: 'logankuzyk.com' }, 'id-1')).toMatchObject({
      title: 'Portfolio',
    })
    expect(makeFavourite({ url: 'nope' })).toBeNull()
  })
})

describe('addFavourite', () => {
  it('appends a site', () => {
    expect(addFavourite(list('A'), { url: 'b.com' }, 'id-b')).toEqual([
      ...list('A'),
      { id: 'id-b', title: 'b.com', url: 'https://b.com/' },
    ])
  })

  it('ignores an unusable URL', () => {
    expect(addFavourite(list('A'), { url: 'nope' })).toEqual(list('A'))
  })

  it('stops at the cap, to stay inside the sync quota', () => {
    const full = Array.from({ length: MAX_FAVOURITES }, (_, index) => ({
      id: String(index),
      title: `Site ${index}`,
      url: `https://site${index}.com/`,
    }))

    expect(addFavourite(full, { url: 'one-too-many.com' })).toHaveLength(MAX_FAVOURITES)
  })
})

describe('updateFavourite', () => {
  it('edits the name and the address', () => {
    const [first] = updateFavourite(list('A'), '0', { title: 'Renamed', url: 'c.com' })
    expect(first).toEqual({ id: '0', title: 'Renamed', url: 'https://c.com/' })
  })

  it('falls back to the hostname when the name is cleared', () => {
    expect(updateFavourite(list('A'), '0', { title: '  ' })[0]?.title).toBe('a.com')
  })

  it('keeps the old address when the new one is unusable', () => {
    expect(updateFavourite(list('A'), '0', { url: 'nope' })[0]?.url).toBe('https://a.com/')
  })

  it('leaves the other sites alone', () => {
    expect(updateFavourite(list('A', 'B'), '0', { title: 'X' })[1]).toEqual(list('A', 'B')[1])
  })
})

describe('removeFavourite', () => {
  it('removes by id', () => {
    expect(removeFavourite(list('A', 'B'), '0').map((f) => f.title)).toEqual(['B'])
  })
})

describe('moveFavourite', () => {
  it('moves a site up and down', () => {
    const items = list('A', 'B', 'C')
    expect(moveFavourite(items, '1', -1).map((f) => f.title)).toEqual(['B', 'A', 'C'])
    expect(moveFavourite(items, '1', 1).map((f) => f.title)).toEqual(['A', 'C', 'B'])
  })

  it('keeps the ends in place', () => {
    const items = list('A', 'B')
    expect(moveFavourite(items, '0', -1)).toEqual(items)
    expect(moveFavourite(items, '1', 1)).toEqual(items)
    expect(moveFavourite(items, 'missing', 1)).toEqual(items)
  })
})

describe('favouritesItem', () => {
  it('syncs and starts empty', async () => {
    expect(favouritesItem.key).toBe('sync:favourites')
    expect(await favouritesItem.getValue()).toEqual([])
  })

  it('round-trips a list', async () => {
    await favouritesItem.setValue(list('A'))
    expect(await favouritesItem.getValue()).toEqual(list('A'))
  })
})
