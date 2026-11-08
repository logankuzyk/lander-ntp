import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { poolFor } from './pool'

const photos = [
  makePhoto('ordinary', { tags: [{ name: 'Water', optIn: false, slug: 'water' }] }),
  makePhoto('pattern', { tags: [{ name: 'Patterns', optIn: true, slug: 'patterns' }] }),
  makePhoto('both', {
    tags: [
      { name: 'Patterns', optIn: true, slug: 'patterns' },
      { name: 'Water', optIn: false, slug: 'water' },
    ],
  }),
]

describe('poolFor', () => {
  it('uses present favourites alone, even when tags and pattern tags would exclude them', () => {
    expect(
      poolFor({
        favourites: ['ordinary', 'both'],
        favouritesOnly: true,
        photos,
        tags: ['patterns'],
      }),
    ).toEqual({ favouritesGone: false, ids: ['ordinary', 'both'], source: 'favourites' })
  })

  it('falls back to the usual tag pool and reports when every favourite is gone', () => {
    expect(
      poolFor({ favourites: ['removed'], favouritesOnly: true, photos, tags: ['water'] }),
    ).toEqual({ favouritesGone: true, ids: ['ordinary', 'both'], source: 'tags' })
  })

  it('uses the all pool when favourites only is off', () => {
    expect(poolFor({ favourites: ['ordinary'], favouritesOnly: false, photos, tags: [] })).toEqual({
      favouritesGone: false,
      ids: ['ordinary'],
      source: 'all',
    })
  })

  it('does not judge favourites against the bundled fallback photo', () => {
    expect(
      poolFor({
        favourites: ['removed'],
        favouritesOnly: true,
        photos: [makePhoto('fallback')],
        tags: ['water'],
      }),
    ).toEqual({ favouritesGone: false, ids: ['fallback'], source: 'all' })
  })
})
