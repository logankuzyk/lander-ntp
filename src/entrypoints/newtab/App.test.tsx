import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { manifestCache, photoState } from '@/photos/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { App } from './App'

const creditLink = () => screen.findByRole('link', { name: 'View on logankuzyk.com' })

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

    const first = (await creditLink()).getAttribute('href')
    // The → key is covered in Controls.test.tsx. Here, click: the button's handler updates in
    // the same render as the credit link, while the key listener re-binds after paint.
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    const link = await creditLink()
    await waitFor(() => expect(link.getAttribute('href')).not.toBe(first))
    const stored = await photoState.getValue()
    expect(link.getAttribute('href')).toContain(`photo=${stored?.currentId}`)
  })

  it('shows the bundled photo when offline with nothing cached', async () => {
    render(<App />)

    expect((await creditLink()).getAttribute('href')).toBe('https://logankuzyk.com/photography')
  })

  it('hides the clock and the credit when they are switched off', async () => {
    await seedPhotos()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
      widgets: { ...DEFAULT_SETTINGS.widgets, credit: false },
    })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('time')).toBeNull())
    expect(screen.queryByRole('link', { name: 'View on logankuzyk.com' })).toBeNull()
  })

  it('applies the chosen font and keeps it', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(await screen.findByLabelText('Font'), { target: { value: 'inter' } })

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--font-display')).toContain('Inter'),
    )
    expect((await settingsItem.getValue()).font).toBe('inter')
  })

  it('closes the settings panel with Escape', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
