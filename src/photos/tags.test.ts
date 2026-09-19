import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { availableTags, filterByTag, photoTag } from './tags'

const inCollection = (id: string, slug: string) =>
  makePhoto(id, { pageUrl: `https://logankuzyk.com/photography/${slug}?photo=${id}` })

describe('photoTag', () => {
  it('names the collection the photo opens in', () => {
    expect(photoTag(inCollection('a', 'japan'))).toEqual({ slug: 'japan', name: 'Japan' })
    expect(photoTag(inCollection('a', 'new-zealand'))).toEqual({
      slug: 'new-zealand',
      name: 'New Zealand',
    })
  })

  it('has none for a photo that only links to the photography index', () => {
    expect(photoTag(makePhoto('a', { pageUrl: 'https://logankuzyk.com/photography' }))).toBeNull()
  })

  it('has none for the catch-all collection', () => {
    expect(photoTag(inCollection('a', 'all'))).toBeNull()
  })

  it('has none for a link it cannot read', () => {
    expect(photoTag(inCollection('a', '%E0%A4%A'))).toBeNull()
  })
})

describe('availableTags', () => {
  it('lists each tag once, the most common first, then by name', () => {
    const photos = [
      inCollection('a', 'nature'),
      inCollection('b', 'beach'),
      inCollection('c', 'nature'),
      inCollection('d', 'china'),
      inCollection('e', 'all'),
    ]

    expect(availableTags(photos).map((tag) => tag.name)).toEqual(['Nature', 'Beach', 'China'])
  })

  it('is empty when no photo has a tag', () => {
    expect(
      availableTags([makePhoto('a', { pageUrl: 'https://logankuzyk.com/photography' })]),
    ).toEqual([])
  })
})

describe('filterByTag', () => {
  const photos = [
    inCollection('a', 'nature'),
    inCollection('b', 'beach'),
    inCollection('c', 'nature'),
  ]

  it('keeps the photos with the tag', () => {
    expect(filterByTag(photos, 'nature').map((photo) => photo.id)).toEqual(['a', 'c'])
  })

  it('keeps everything without one', () => {
    expect(filterByTag(photos, null)).toBe(photos)
  })
})
