import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import type { Tag } from './schema'
import { availableTags, filterByTag, poolIds } from './tags'

const tag = (slug: string): Tag => ({
  name: slug[0]?.toUpperCase() + slug.slice(1),
  optIn: false,
  slug,
})
const tagged = (id: string, ...slugs: string[]) => makePhoto(id, { tags: slugs.map(tag) })

describe('availableTags', () => {
  it('lists each tag once, the most common first, then by name', () => {
    const photos = [
      tagged('a', 'water', 'forest'),
      tagged('b', 'urban'),
      tagged('c', 'water', 'urban'),
      tagged('d', 'beach'),
      tagged('e'),
    ]

    expect(availableTags(photos).map((t) => t.name)).toEqual(['Urban', 'Water', 'Beach', 'Forest'])
  })

  it('is empty when no photo has a tag', () => {
    expect(availableTags([tagged('a'), tagged('b')])).toEqual([])
  })
})

describe('filterByTag', () => {
  const photos = [tagged('a', 'water', 'forest'), tagged('b', 'urban'), tagged('c', 'forest')]

  it('keeps the photos with the tag', () => {
    expect(filterByTag(photos, 'forest').map((photo) => photo.id)).toEqual(['a', 'c'])
  })

  it('keeps everything without one', () => {
    expect(filterByTag(photos, null).map(({ id }) => id)).toEqual(['a', 'b', 'c'])
  })

  it('excludes photos with a flagged tag from All, but includes them under either chosen tag', () => {
    const pattern = { name: 'Pattern', optIn: true, slug: 'pattern' }
    const mixed = [
      makePhoto('ordinary'),
      makePhoto('pattern', { tags: [pattern] }),
      makePhoto('both', { tags: [pattern, tag('water')] }),
    ]

    expect(filterByTag(mixed, null).map(({ id }) => id)).toEqual(['ordinary'])
    expect(filterByTag(mixed, 'pattern').map(({ id }) => id)).toEqual(['pattern', 'both'])
    expect(filterByTag(mixed, 'water').map(({ id }) => id)).toEqual(['both'])
  })
})

describe('poolIds', () => {
  const photos = [tagged('a', 'water'), tagged('b', 'urban'), tagged('c', 'water'), tagged('d')]

  it('cycles the photos with the tag', () => {
    expect(poolIds(photos, ['water'])).toEqual(['a', 'c'])
  })

  it('cycles the photos with any of the tags', () => {
    expect(poolIds(photos, ['urban', 'water'])).toEqual(['a', 'b', 'c'])
  })

  it('cycles everything with no tags, or ones no photo has', () => {
    expect(poolIds(photos, [])).toEqual(['a', 'b', 'c', 'd'])
    expect(poolIds(photos, ['gone'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps pattern photos out of All until a matching tag is chosen', () => {
    const pattern = { name: 'Patterns', optIn: true, slug: 'patterns' }
    const mixed = [
      makePhoto('ordinary'),
      makePhoto('pattern', { tags: [pattern] }),
      makePhoto('both', { tags: [pattern, tag('water')] }),
    ]

    expect(poolIds(mixed, [])).toEqual(['ordinary'])
    expect(poolIds(mixed, ['patterns'])).toEqual(['pattern', 'both'])
    expect(poolIds(mixed, ['water'])).toEqual(['both'])
    expect(poolIds(mixed, ['gone'])).toEqual(['ordinary'])
  })

  it('falls back to all photos when every photo has a pattern tag', () => {
    const pattern = { name: 'Patterns', optIn: true, slug: 'patterns' }

    expect(poolIds([makePhoto('a', { tags: [pattern] })], ['gone'])).toEqual(['a'])
  })
})
