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

/**
 * Photos for stories: three of Logan Kuzyk's own, from logankuzyk.com, each the smallest
 * rendition its manifest offers (300px wide) and committed in `.storybook/public/story-photos/`,
 * which Storybook serves. Location, camera settings, tags and alt text are the manifest's, so
 * the photo credit and details panel read as they do for a real photo. The manifest has no
 * licence field: they are the site owner's work, used here with his say-so. The links stay on
 * the page and no size is remote, so no story loads anything from logankuzyk.com or
 * media.logankuzyk.com.
 */
export const STORY_PHOTOS: Photo[] = [
  // Sombrio Beach: https://logankuzyk.com/photography/beach?photo=69a656b8d61aea8798094721
  makePhoto('story-coast', {
    alt: 'A person stands on the dark, rocky shore of Sombrio Beach facing a large rock formation in the ocean.',
    exif: {
      aperture: 'f/5',
      camera: 'Canon, EOS REBEL T4i',
      dateTaken: '2024-05-19T17:35:30.000Z',
      focalLength: '123.0mm',
      iso: 'ISO 250',
      shutter: '1/4000s',
    },
    height: 2828,
    location: 'Sombrio Beach, Vancouver Island, British Columbia',
    pageUrl: '#story-coast',
    sizes: [{ url: '/story-photos/beach.webp', width: 300 }],
    tags: [
      { name: 'Water', slug: 'water' },
      { name: 'People', slug: 'people' },
      { name: 'Beach', slug: 'beach' },
    ],
    width: 4242,
  }),
  // Vancouver Island: https://logankuzyk.com/photography/nature?photo=69a65698d61aea87980946d9
  makePhoto('story-forest', {
    alt: 'A single small purple flower blooms on a thin stem amidst green fern-like leaves in a dark forest setting.',
    exif: {
      aperture: 'f/4',
      camera: 'Canon, EOS REBEL T4i',
      dateTaken: '2025-06-01T13:31:36.000Z',
      focalLength: '50.0mm',
      iso: 'ISO 100',
      shutter: '1/80s',
    },
    height: 2828,
    location: 'Vancouver Island, British Columbia',
    pageUrl: '#story-forest',
    sizes: [{ url: '/story-photos/forest.webp', width: 300 }],
    tags: [
      { name: 'Plants', slug: 'plants' },
      { name: 'Forest', slug: 'forest' },
    ],
    width: 4242,
  }),
  // Landslide Lake: https://logankuzyk.com/photography/nature?photo=6a109b3d912438fa4f84a6e9
  makePhoto('story-mountain', {
    alt: 'Landslide Lake',
    exif: {
      aperture: 'f/7.1',
      camera: 'SONY, ILCE-6000',
      dateTaken: '2026-05-17T09:50:24.000Z',
      focalLength: '16.0mm',
      iso: 'ISO 100',
      shutter: '1/320s',
    },
    height: 2828,
    location: 'Strathcona Provincial Park',
    pageUrl: '#story-mountain',
    sizes: [{ url: '/story-photos/mountain.webp', width: 300 }],
    tags: [{ name: 'Mountains', slug: 'mountains' }],
    width: 4242,
  }),
]
