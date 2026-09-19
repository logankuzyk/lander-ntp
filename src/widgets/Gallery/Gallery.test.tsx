import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import type { Photo } from '@/photos/schema'
import { makePhoto } from '@/test/fixtures'

import { Gallery } from './Gallery'

const inCollection = (id: string, slug: string, overrides: Partial<Photo> = {}) =>
  makePhoto(id, { pageUrl: `https://logankuzyk.com/photography/${slug}?photo=${id}`, ...overrides })

const PHOTOS = [
  inCollection('a', 'nature', { alt: 'Waterfall' }),
  inCollection('b', 'beach', { alt: 'Tide pools' }),
  inCollection('c', 'nature', { alt: 'Old growth' }),
]

const renderGallery = (photos: Photo[] = PHOTOS, currentId: string | null = 'b') => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <Gallery photos={photos} currentId={currentId} onSelect={onSelect} onClose={onClose} />,
  )
  return { ...view, onSelect, onClose }
}

const photoButtons = () =>
  within(screen.getByRole('list')).getAllByRole('button') as HTMLButtonElement[]

const photoNames = () => photoButtons().map((button) => button.querySelector('img')?.alt)

describe('Gallery', () => {
  it('shows every photo as a small thumbnail', () => {
    renderGallery()

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
    renderGallery([
      makePhoto('a', { alt: null, location: 'Tofino, BC' }),
      makePhoto('b', { alt: null }),
    ])

    expect(photoNames()).toEqual(['Tofino, BC', 'Photo 2'])
  })

  it('picks a photo', () => {
    const { onSelect, onClose } = renderGallery()

    fireEvent.click(screen.getByRole('button', { name: 'Old growth' }))

    expect(onSelect).toHaveBeenCalledWith('c')
    // Stays open, to try another.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('filters by tag, most common first', () => {
    renderGallery()
    const filters = within(screen.getByRole('group', { name: 'Filter photos' }))

    expect(filters.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'All',
      'Nature',
      'Beach',
    ])
    expect(filters.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(filters.getByRole('button', { name: 'Nature' }))

    expect(photoNames()).toEqual(['Waterfall', 'Old growth'])
    expect(filters.getByRole('button', { name: 'Nature' }).getAttribute('aria-pressed')).toBe(
      'true',
    )

    // Pressing it again, or All, shows everything.
    fireEvent.click(filters.getByRole('button', { name: 'Nature' }))
    expect(photoNames()).toHaveLength(3)
    fireEvent.click(filters.getByRole('button', { name: 'Beach' }))
    fireEvent.click(filters.getByRole('button', { name: 'All' }))
    expect(photoNames()).toHaveLength(3)
  })

  it('leaves out the tags when no photo has one', () => {
    renderGallery([
      makePhoto('a', { pageUrl: 'https://logankuzyk.com/photography' }),
      makePhoto('b', { pageUrl: 'https://logankuzyk.com/photography' }),
    ])

    expect(screen.queryByRole('group', { name: 'Filter photos' })).toBeNull()
  })

  it('grows before it scrolls, holding the top row in place', () => {
    renderGallery()
    const dialog = screen.getByRole('dialog', { name: 'Choose a photo' })
    const scroller = dialog.querySelector<HTMLElement>('.gallery__scroller') as HTMLElement
    // No layout here: a 1000px grid showing 200px, in a popover capped at 800px.
    const grown = () => parseFloat(scroller.style.getPropertyValue('--gallery-grow') || '0')
    dialog.style.maxHeight = '800px'
    Object.defineProperty(dialog, 'offsetHeight', { get: () => 300 + grown() })
    Object.defineProperty(scroller, 'clientHeight', { get: () => 200 + grown() })
    Object.defineProperty(scroller, 'scrollHeight', { value: 1000 })
    Object.defineProperty(scroller, 'scrollTop', { value: 0, writable: true })

    const first = new WheelEvent('wheel', { deltaY: 450, cancelable: true })
    scroller.dispatchEvent(first)

    expect(first.defaultPrevented).toBe(true)
    expect(grown()).toBe(450)
    expect(scroller.scrollTop).toBe(0)

    // 50px short of the cap: the rest of the wheel scrolls.
    scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }))
    expect(grown()).toBe(500)
    expect(scroller.scrollTop).toBe(50)

    // At the cap, and scrolling up, the browser scrolls as usual.
    const atCap = new WheelEvent('wheel', { deltaY: 100, cancelable: true })
    scroller.dispatchEvent(atCap)
    const up = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
    scroller.dispatchEvent(up)
    expect(atCap.defaultPrevented).toBe(false)
    expect(up.defaultPrevented).toBe(false)
    expect(grown()).toBe(500)
  })

  it('opens as a labelled dialog with the close button focused', () => {
    renderGallery()

    expect(screen.getByRole('dialog', { name: 'Choose a photo' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close photos' }))
  })

  it('closes with the button and with Escape', () => {
    const { onClose } = renderGallery()

    fireEvent.click(screen.getByRole('button', { name: 'Close photos' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('gives focus back to whatever opened it', () => {
    render(<button type="button">Opener</button>)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    const { unmount } = renderGallery()

    unmount()

    expect(document.activeElement).toBe(opener)
  })
})
