import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { favouritesItem } from '@/backdrop/favourites'
import type { Photo } from '@/photos/schema'
import { makePhoto } from '@/test/fixtures'

import { Gallery } from './Gallery'

const FOREST = { name: 'Forest', optIn: false, slug: 'forest' }
const WATER = { name: 'Water', optIn: false, slug: 'water' }
const BEACH = { name: 'Beach', optIn: false, slug: 'beach' }

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [WATER, FOREST] }),
  makePhoto('b', { alt: 'Tide pools', tags: [BEACH, WATER] }),
  makePhoto('c', { alt: 'Old growth', tags: [FOREST] }),
]

const renderGallery = ({
  currentId = 'b',
  initialTag = null,
  photos = PHOTOS,
}: { currentId?: string | null; initialTag?: string | null; photos?: Photo[] } = {}) => {
  const onSelect = vi.fn()
  render(
    <Gallery currentId={currentId} initialTag={initialTag} onSelect={onSelect} photos={photos} />,
  )
  return { onSelect }
}

const photoButtons = () =>
  (within(screen.getByRole('list')).getAllByRole('button') as HTMLButtonElement[]).filter(
    (button) => button.classList.contains('gallery__photo'),
  )

const photoNames = () => photoButtons().map((button) => button.querySelector('img')?.alt)

const filters = () => within(screen.getByRole('group', { name: 'Filter photos' }))

const pressed = () =>
  filters()
    .getAllByRole('button')
    .find((chip) => chip.getAttribute('aria-pressed') === 'true')?.textContent

describe('Gallery', () => {
  it('does not offer a heart for the bundled fallback photo', () => {
    renderGallery({ photos: [makePhoto('fallback')] })

    expect(screen.queryByRole('button', { name: 'Favourite Photo 1 to favourites' })).toBeNull()
  })

  it('filters to present favourites newest first, and a heart does not pick its photo', async () => {
    await fakeBrowser.storage.sync.clear()
    await favouritesItem.setValue({ ids: ['d', 'c', 'a', 'gone'], v: 1 })
    const photos = [
      ...PHOTOS,
      makePhoto('d', {
        alt: 'Pattern',
        tags: [{ name: 'Pattern', optIn: true, slug: 'pattern' }],
      }),
    ]
    const { onSelect } = renderGallery({ photos })

    const filter = await screen.findByRole('button', { name: 'Favourites' })
    fireEvent.click(filter)
    expect(photoNames()).toEqual(['Pattern', 'Old growth', 'Waterfall'])

    fireEvent.click(filters().getByRole('button', { name: 'Forest' }))
    expect(photoNames()).toEqual(['Waterfall', 'Old growth'])
    fireEvent.click(filters().getByRole('button', { name: 'Favourites' }))

    fireEvent.click(screen.getByRole('button', { name: 'Remove Old growth from favourites' }))
    expect(onSelect).not.toHaveBeenCalled()
    await waitFor(async () =>
      expect((await favouritesItem.getValue()).ids).toEqual(['d', 'a', 'gone']),
    )
  })

  it('hides the Favourites chip when no favourite is on the site', async () => {
    await fakeBrowser.storage.sync.clear()
    await favouritesItem.setValue({ ids: ['gone'], v: 1 })
    renderGallery()

    await waitFor(() => expect(screen.getByRole('group', { name: 'Filter photos' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Favourites' })).toBeNull()
  })

  it('disables gallery hearts when favourites were written by a newer version', async () => {
    await fakeBrowser.storage.sync.clear()
    await fakeBrowser.storage.sync.set({ favourites: { ids: ['a'], v: 2 } })
    renderGallery()

    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Remove Waterfall from favourites' })
          .hasAttribute('disabled'),
      ).toBe(true),
    )
  })

  it('shows every photo as a small thumbnail', () => {
    renderGallery()

    expect(screen.getByRole('heading', { name: 'Gallery' })).toBeTruthy()
    expect(photoNames()).toEqual(['Waterfall', 'Tide pools', 'Old growth'])
    const image = photoButtons()[0]?.querySelector('img')
    expect(image?.getAttribute('src')).toBe('https://media.logankuzyk.com/photos/a/pic-300.webp')
    expect(image?.getAttribute('loading')).toBe('lazy')
  })

  it('shows unflagged photos under All and keeps flagged tags available', () => {
    const photos = [
      makePhoto('ordinary', { alt: 'Ordinary' }),
      makePhoto('pattern', {
        alt: 'Pattern',
        tags: [{ name: 'Pattern', optIn: true, slug: 'pattern' }],
      }),
      makePhoto('mixed', {
        alt: 'Mixed',
        tags: [
          { name: 'Pattern', optIn: true, slug: 'pattern' },
          { name: 'Water', optIn: false, slug: 'water' },
        ],
      }),
    ]
    renderGallery({ photos })

    expect(photoNames()).toEqual(['Ordinary'])
    expect(filters().getByRole('button', { name: 'Pattern' })).toBeTruthy()

    fireEvent.click(filters().getByRole('button', { name: 'Pattern' }))
    expect(photoNames()).toEqual(['Pattern', 'Mixed'])

    fireEvent.click(filters().getByRole('button', { name: 'Water' }))
    expect(photoNames()).toEqual(['Mixed'])
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

  it('marks a thumbnail that fails to load, keeping it pickable', () => {
    const { onSelect } = renderGallery()
    const [first, second] = photoButtons()

    fireEvent.error(first!.querySelector('img')!)

    expect(first?.classList.contains('gallery__photo--broken')).toBe(true)
    expect(second?.classList.contains('gallery__photo--broken')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Waterfall' }))
    expect(onSelect).toHaveBeenCalledWith('a')
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
