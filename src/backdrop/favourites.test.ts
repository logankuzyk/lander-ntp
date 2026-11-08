import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import {
  checkFavourites,
  favouritesItem,
  isFavourite,
  presentFavourites,
  toggleFavourite,
} from './favourites'

describe('favourites', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
  })

  it('toggles an id to the front and removes it without duplicates', () => {
    expect(toggleFavourite(['a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
    expect(toggleFavourite(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleFavourite(['a', 'a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
    expect(isFavourite(['a', 'b'], 'b')).toBe(true)
  })

  it('keeps favourites whose photos are absent from the current list', () => {
    expect(presentFavourites(['gone', 'here'], [{ id: 'here' }])).toEqual(['here'])
  })

  it('keeps unknown keys and makes malformed favourites safe to read', () => {
    expect(checkFavourites({ ids: ['a'], later: 2, v: 1 })).toEqual({ ids: ['a'], later: 2, v: 1 })
    expect(checkFavourites({ ids: 'bad', v: 1 })).toEqual({ ids: [], v: 1 })
    expect(checkFavourites(null)).toEqual({ ids: [], v: 1 })
  })

  it('drops non-string ids from a stored favourites list', () => {
    expect(checkFavourites({ ids: ['a', 7, null, 'b'], v: 1 }).ids).toEqual(['a', 'b'])
  })

  it('removes duplicate ids from a stored favourites list', () => {
    expect(checkFavourites({ ids: ['a', 'b', 'a'], v: 1 }).ids).toEqual(['a', 'b'])
  })

  it('does not write defaults on load and refuses newer values unchanged', async () => {
    expect((await favouritesItem.read()).value).toEqual({ ids: [], v: 1 })
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({})
    const raw = { extra: true, ids: ['future'], v: 2 }
    await fakeBrowser.storage.sync.set({ favourites: raw })
    expect((await favouritesItem.read()).newer).toBe(true)
    await expect(favouritesItem.setValue({ ids: [], v: 1 })).rejects.toThrow()
    expect((await fakeBrowser.storage.sync.get('favourites')).favourites).toEqual(raw)
  })

  it('stores 87 ids in the expected sync quota budget', () => {
    const value = {
      ids: [
        ...Array.from({ length: 77 }, () => 'x'.repeat(24)),
        ...Array.from({ length: 10 }, () => 'x'.repeat(25)),
      ],
      v: 1,
    }
    expect(new TextEncoder().encode(JSON.stringify(value)).byteLength).toBe(2374)
  })
})
