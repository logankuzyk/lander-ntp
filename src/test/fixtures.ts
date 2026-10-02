import type { Manifest, Photo } from '@/photos/schema'

export const makePhoto = (id: string, overrides: Partial<Photo> = {}): Photo => ({
  alt: `Photo ${id}`,
  exif: {},
  focalX: null,
  focalY: null,
  height: 4000,
  id,
  location: null,
  pageUrl: `https://logankuzyk.com/photography/coast?photo=${id}`,
  printUrl: null,
  sizes: [
    { url: `https://media.logankuzyk.com/photos/${id}/pic-300.webp`, width: 300 },
    { url: `https://media.logankuzyk.com/photos/${id}/pic-1920.webp`, width: 1920 },
  ],
  tags: [],
  width: 6000,
  ...overrides,
})

export const makeManifest = (photos: Photo[]): Manifest => ({
  generatedAt: '2026-09-11T12:00:00.000Z',
  photos,
  version: 1,
})

/** Deterministic Math.random replacement (LCG). */
export const seededRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
