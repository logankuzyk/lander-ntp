import { describe, expect, it } from 'vitest'

import { makePhoto } from '@/test/fixtures'

import { buildSrcSet, largestUrl, objectPosition, preloadNext, thumbnailUrl } from './image'

const MEDIA = 'https://media.logankuzyk.com/photos/a'

describe('buildSrcSet', () => {
  it('lists every available size with its width', () => {
    expect(buildSrcSet(makePhoto('a').sizes)).toBe(
      `${MEDIA}/pic-300.webp 300w, ${MEDIA}/pic-1920.webp 1920w`,
    )
  })

  it('handles a sparse ladder with a single size', () => {
    expect(buildSrcSet([{ url: `${MEDIA}/pic-300.webp`, width: 300 }])).toBe(
      `${MEDIA}/pic-300.webp 300w`,
    )
  })
})

describe('thumbnailUrl and largestUrl', () => {
  it('pick the smallest and largest renditions', () => {
    const photo = makePhoto('a')
    expect(thumbnailUrl(photo)).toBe(`${MEDIA}/pic-300.webp`)
    expect(largestUrl(photo)).toBe(`${MEDIA}/pic-1920.webp`)
  })
})

describe('objectPosition', () => {
  it('maps the focal point to percentages', () => {
    expect(objectPosition({ focalX: 30, focalY: 72.5 })).toBe('30% 72.5%')
  })

  it('centres a missing focal point', () => {
    expect(objectPosition({ focalX: null, focalY: null })).toBe('50% 50%')
    expect(objectPosition({ focalX: 0, focalY: null })).toBe('0% 50%')
  })
})

describe('preloadNext', () => {
  it('requests the thumbnail and the full image with a viewport-wide srcset', () => {
    const [thumbnail, full] = preloadNext(makePhoto('a'))

    expect(thumbnail?.getAttribute('src')).toBe(`${MEDIA}/pic-300.webp`)
    expect(full?.getAttribute('sizes')).toBe('100vw')
    expect(full?.getAttribute('srcset')).toBe(
      `${MEDIA}/pic-300.webp 300w, ${MEDIA}/pic-1920.webp 1920w`,
    )
    expect(full?.getAttribute('src')).toBe(`${MEDIA}/pic-1920.webp`)
  })
})
