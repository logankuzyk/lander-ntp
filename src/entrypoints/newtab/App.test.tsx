import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { manifestCache, photoState } from '@/photos/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'

import { App } from './App'

const creditLink = () => screen.findByRole('link', { name: 'View on logankuzyk.com' })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    await manifestCache.setValue({
      etag: null,
      fetchedAt: Date.now(),
      data: makeManifest([makePhoto('a'), makePhoto('b')]),
    })
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
})
