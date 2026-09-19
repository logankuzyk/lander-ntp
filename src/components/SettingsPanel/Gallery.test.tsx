import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import type { Photo } from '@/photos/schema'
import { makePhoto } from '@/test/fixtures'

import { Gallery } from './Gallery'

const FOREST = { slug: 'forest', name: 'Forest' }
const WATER = { slug: 'water', name: 'Water' }
const BEACH = { slug: 'beach', name: 'Beach' }

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [WATER, FOREST] }),
  makePhoto('b', { alt: 'Tide pools', tags: [BEACH, WATER] }),
  makePhoto('c', { alt: 'Old growth', tags: [FOREST] }),
]

const renderGallery = ({
  photos = PHOTOS,
  currentId = 'b',
  initialTag = null,
}: { photos?: Photo[]; currentId?: string | null; initialTag?: string | null } = {}) => {
  const onSelect = vi.fn()
  render(
    <Gallery photos={photos} currentId={currentId} initialTag={initialTag} onSelect={onSelect} />,
  )
  return { onSelect }
}

const photoButtons = () =>
  within(screen.getByRole('list')).getAllByRole('button') as HTMLButtonElement[]

const photoNames = () => photoButtons().map((button) => button.querySelector('img')?.alt)

const filters = () => within(screen.getByRole('group', { name: 'Filter photos' }))

const pressed = () =>
  filters()
    .getAllByRole('button')
    .find((chip) => chip.getAttribute('aria-pressed') === 'true')?.textContent

describe('Gallery', () => {
  it('shows every photo as a small thumbnail', () => {
    renderGallery()

    expect(screen.getByRole('heading', { name: 'Gallery' })).toBeTruthy()
    expect(photoNames()).toEqual(['Waterfall', 'Tide pools', 'Old growth'])
    const image = photoButtons()[0]?.querySelector('img')
    expect(image?.getAttribute('src')).toBe('https://media.logankuzyk.com/photos/a/pic-300.webp')
    expect(image?.getAttribute('loading')).toBe('lazy')
  })

  it('marks the photo on screen', () => {
    renderGallery()

    expect(photoButtons().map((button) => button.getAttribute('aria-current'))).toEqual([
      null,
      'true',
      null,
    ])
  })

  it('names photos without alt text by their location, or their place in the list', () => {
    renderGallery({
      photos: [
        makePhoto('a', { alt: null, location: 'Tofino, BC' }),
        makePhoto('b', { alt: null }),
      ],
    })

    expect(photoNames()).toEqual(['Tofino, BC', 'Photo 2'])
  })

  it('picks a photo', () => {
    const { onSelect } = renderGallery()

    fireEvent.click(screen.getByRole('button', { name: 'Old growth' }))

    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('filters by tag, most common first', () => {
    renderGallery()

    expect(
      filters()
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['All', 'Forest', 'Water', 'Beach'])
    expect(pressed()).toBe('All')

    fireEvent.click(filters().getByRole('button', { name: 'Forest' }))
    expect(photoNames()).toEqual(['Waterfall', 'Old growth'])
    expect(pressed()).toBe('Forest')

    // A photo shows under each of its tags.
    fireEvent.click(filters().getByRole('button', { name: 'Water' }))
    expect(photoNames()).toEqual(['Waterfall', 'Tide pools'])

    // Pressing it again, or All, shows everything.
    fireEvent.click(filters().getByRole('button', { name: 'Water' }))
    expect(photoNames()).toHaveLength(3)
    fireEvent.click(filters().getByRole('button', { name: 'Beach' }))
    fireEvent.click(filters().getByRole('button', { name: 'All' }))
    expect(photoNames()).toHaveLength(3)
  })

  it('starts on the tag being cycled', () => {
    renderGallery({ initialTag: 'beach' })

    expect(pressed()).toBe('Beach')
    expect(photoNames()).toEqual(['Tide pools'])
  })

  it('starts on everything when the cycled tag has gone', () => {
    renderGallery({ initialTag: 'gone' })

    expect(pressed()).toBe('All')
  })

  it('leaves out the tags when no photo has one', () => {
    renderGallery({ photos: [makePhoto('a'), makePhoto('b')] })

    expect(screen.queryByRole('group', { name: 'Filter photos' })).toBeNull()
  })
})
