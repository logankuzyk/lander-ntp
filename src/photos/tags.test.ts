import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import type { Tag } from './schema'
import { availableTags, filterByTag } from './tags'

const tag = (slug: string): Tag => ({ slug, name: slug[0]?.toUpperCase() + slug.slice(1) })
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
    expect(filterByTag(photos, null)).toBe(photos)
  })
})
