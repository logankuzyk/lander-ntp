import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { favouritesItem } from '@/favourites/storage'
import { manifestCache, photoState } from '@/photos/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { App } from './App'

/**
 * The photo on screen: the topmost background layer's full-resolution source. A replacement
 * photo is appended over the one it is cross-fading out, so the last layer is the current one.
 */
const currentPhotoSrc = async () =>
  (
    await waitFor(() => {
      const images = document.querySelectorAll<HTMLImageElement>('.background__full')
      const top = images[images.length - 1]
      if (!top) throw new Error('no photo rendered yet')
      return top
    })
  ).getAttribute('src')

const seedPhotos = () =>
  manifestCache.setValue({
    etag: null,
    fetchedAt: Date.now(),
    data: makeManifest([makePhoto('a'), makePhoto('b')]),
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App', () => {
  it('renders the clock', () => {
    // <time> has no implicit ARIA role, so query the element directly.
    const { container } = render(<App />)
    const clock = container.querySelector('time')
    expect(clock?.getAttribute('datetime')).toBeTruthy()
    expect(clock?.textContent).toMatch(/^\d{1,2}:\d{2}$/)
  })

  it('shows a cached photo and moves to the next one', async () => {
    await seedPhotos()
    render(<App />)

    const first = await currentPhotoSrc()
    // The → key is covered in Controls.test.tsx.
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    await waitFor(async () => expect(await currentPhotoSrc()).not.toBe(first))
    const stored = await photoState.getValue()
    expect(await currentPhotoSrc()).toContain(`/photos/${stored?.currentId}/`)
  })

  it('shows the bundled photo when offline with nothing cached', async () => {
    render(<App />)

    expect(await currentPhotoSrc()).toMatch(/\/fallback\.webp$/)
  })

  it('hides the clock and the credit when they are switched off', async () => {
    // The credit only has anything to show when the photo carries a location.
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: makeManifest([makePhoto('a', { location: 'Tofino, BC' })]),
    })
    const { unmount } = render(<App />)
    expect(await screen.findByText('Tofino, BC')).toBeTruthy()

    unmount()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
      widgets: { ...DEFAULT_SETTINGS.widgets, credit: false },
    })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('time')).toBeNull())
    expect(container.querySelector('.credit')).toBeNull()
  })

  it('shows saved favourite sites, and hides them when switched off', async () => {
    await favouritesItem.setValue([{ id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' }])
    const { unmount } = render(<App />)

    expect((await screen.findByRole('link', { name: 'Portfolio' })).getAttribute('href')).toBe(
      'https://logankuzyk.com/',
    )

    unmount()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      favourites: { ...DEFAULT_SETTINGS.favourites, enabled: false },
    })
    render(<App />)

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Portfolio' })).toBeNull())
  })

  it('opens the photo details panel, and hides it when the widget is off', async () => {
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: makeManifest([makePhoto('a', { exif: { camera: 'Canon, EOS R5' } })]),
    })
    const { unmount } = render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Photo details' }))
    const panel = await screen.findByRole('dialog', { name: 'Photo details' })
    expect(panel.textContent).toContain('Canon, EOS R5')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Photo details' })).toBeNull())

    unmount()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      widgets: { ...DEFAULT_SETTINGS.widgets, info: false },
    })
    render(<App />)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Photo details' })).toBeNull())
  })

  it('opening a new tab keeps the photo when the frequency is not every-new-tab', async () => {
    await seedPhotos()
    await photoState.setValue({ currentId: 'a', shownAt: Date.now(), bag: ['b'] })
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, frequency: 'daily' })

    render(<App />)

    expect(await currentPhotoSrc()).toContain('/photos/a/')
    // Nothing written, so other open tabs see no change either.
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('applies the chosen font and keeps it', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(await screen.findByLabelText('Font'), { target: { value: 'geist' } })

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--font-display')).toContain(
        'Geist Sans',
      ),
    )
    expect((await settingsItem.getValue()).font).toBe('geist')
  })

  it('closes the settings panel with Escape', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
