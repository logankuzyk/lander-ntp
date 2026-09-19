import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  it('renders the clock', async () => {
    // <time> has no implicit ARIA role, so query the element directly.
    const { container } = render(<App />)

    // Nothing on the first paint: the clock waits for the stored settings rather than being
    // drawn from the defaults and corrected.
    expect(container.querySelector('time')).toBeNull()

    await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
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

  it('shows the credit whenever the photo carries a location', async () => {
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: makeManifest([makePhoto('a', { location: 'Tofino, BC' })]),
    })
    render(<App />)

    expect(await screen.findByText('Tofino, BC')).toBeTruthy()
  })

  it('hides the clock when it is switched off', async () => {
    await seedPhotos()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
    })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.background')).not.toBeNull())
    expect(container.querySelector('time')).toBeNull()
  })

  it('opens the photo details panel', async () => {
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: makeManifest([makePhoto('a', { exif: { camera: 'Canon, EOS R5' } })]),
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Photo details' }))
    const panel = await screen.findByRole('dialog', { name: 'Photo details' })
    expect(panel.textContent).toContain('Canon, EOS R5')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Photo details' })).toBeNull())
  })

  it('pins a photo picked from the gallery in settings', async () => {
    await seedPhotos()
    await photoState.setValue({ currentId: 'a', shownAt: Date.now(), bag: ['b'] })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, frequency: '1h' },
    })
    render(<App />)
    expect(await currentPhotoSrc()).toContain('/photos/a/')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const settings = await screen.findByRole('dialog', { name: 'Settings' })
    fireEvent.click(await within(settings).findByRole('button', { name: 'Photo b' }))

    await waitFor(async () => expect(await currentPhotoSrc()).toContain('/photos/b/'))
    await waitFor(async () =>
      expect((await settingsItem.getValue()).photos).toEqual({
        mode: 'pinned',
        frequency: '1h',
        tag: null,
        pinnedId: 'b',
      }),
    )
    expect((await photoState.getValue())?.currentId).toBe('b')
  })

  it('pins the next photo when → is pressed while pinned', async () => {
    await seedPhotos()
    await photoState.setValue({ currentId: 'a', shownAt: Date.now(), bag: ['b'] })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, mode: 'pinned', pinnedId: 'a' },
    })
    render(<App />)
    expect(await currentPhotoSrc()).toContain('/photos/a/')

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    await waitFor(async () => expect((await settingsItem.getValue()).photos.pinnedId).toBe('b'))
    expect(await currentPhotoSrc()).toContain('/photos/b/')
  })

  it('opens one popover at a time', async () => {
    await seedPhotos()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Photo details' }))
    expect(await screen.findByRole('dialog', { name: 'Photo details' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Photo details' })).toBeNull()

    // The gear closes what it opened.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes a popover with a click outside, but not with its own button', async () => {
    await seedPhotos()
    render(<App />)
    // The details button waits for a photo.
    await currentPhotoSrc()
    /** A real press: pointerdown, then click. */
    const press = (element: Element) => {
      fireEvent.pointerDown(element)
      fireEvent.click(element)
    }

    press(await screen.findByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    // The other popover's button switches straight to it.
    press(screen.getByRole('button', { name: 'Photo details' }))
    expect(await screen.findByRole('dialog', { name: 'Photo details' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

    // Its own button closes it, rather than closing and reopening it.
    press(screen.getByRole('button', { name: 'Photo details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    press(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    press(document.querySelector('.background') as Element)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('has no gallery button', async () => {
    await seedPhotos()
    render(<App />)

    await currentPhotoSrc()
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull()
  })

  it('opening a new tab keeps the photo when the frequency is not every-new-tab', async () => {
    await seedPhotos()
    await photoState.setValue({ currentId: 'a', shownAt: Date.now(), bag: ['b'] })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, frequency: 'daily' },
    })

    render(<App />)

    expect(await currentPhotoSrc()).toContain('/photos/a/')
    // Nothing written, so other open tabs see no change either.
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('applies the chosen font and keeps it', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'General' }))
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
