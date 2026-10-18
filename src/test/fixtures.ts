import type { Manifest, Photo } from '@/photos/schema'
import type { Place } from '@/settings/schema'
import type { Weather } from '@/weather/openMeteo'

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

/** A full reading on a fair autumn day; sunrise and sunset are wall-clock time at the place. */
export const makeWeather = (overrides: Partial<Weather> = {}): Weather => ({
  code: 2,
  feelsLike: 11.2,
  high: 15.8,
  isDay: true,
  low: 8.4,
  sunrise: '2026-10-17T07:41',
  sunset: '2026-10-17T18:22',
  temperature: 13.4,
  ...overrides,
})

export const makePlace = (overrides: Partial<Place> = {}): Place => ({
  latitude: 48.43,
  longitude: -123.37,
  name: 'Victoria',
  ...overrides,
})

/** The photo the extension ships with, which Storybook serves from `public/` as the page does. */
const LOCAL_PHOTO = '/fallback.webp'

/**
 * Photos for stories. Every size is the bundled fallback and the links stay on the page, so no
 * story loads anything from logankuzyk.com or media.logankuzyk.com.
 */
export const STORY_PHOTOS: Photo[] = [
  makePhoto('story-coast', {
    alt: 'Waves breaking on a rocky shore',
    exif: { aperture: 'f/8', camera: 'Fujifilm X-T5', focalLength: '23mm', iso: '125' },
    location: 'Botanical Beach, BC',
    pageUrl: '#story-coast',
    printUrl: '#story-coast-print',
    sizes: [{ url: LOCAL_PHOTO, width: 1920 }],
    tags: [{ name: 'Coast', slug: 'coast' }],
  }),
  makePhoto('story-forest', {
    alt: 'Fog between tall cedars',
    exif: { camera: 'Fujifilm X-T5', shutter: '1/60' },
    location: 'Cathedral Grove, BC',
    pageUrl: '#story-forest',
    sizes: [{ url: LOCAL_PHOTO, width: 1920 }],
    tags: [
      { name: 'Forest', slug: 'forest' },
      { name: 'Fog', slug: 'fog' },
    ],
  }),
  makePhoto('story-mountain', {
    alt: 'Snow on a ridge at sunrise',
    location: 'Mount Washington, BC',
    pageUrl: '#story-mountain',
    sizes: [{ url: LOCAL_PHOTO, width: 1920 }],
    tags: [{ name: 'Mountains', slug: 'mountains' }],
  }),
]
