import { render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'

import { STORY_PHOTOS } from './fixtures'
import { PAGE_SEEDS, seedPage } from './seed'

const fetchSpy = vi.fn()

/** The photo on screen: the topmost background layer's full-resolution source. */
const shownPhoto = async () =>
  (
    await waitFor(() => {
      const images = document.querySelectorAll<HTMLImageElement>('.background__full')
      const top = images[images.length - 1]
      if (!top) throw new Error('no photo rendered yet')
      return top
    })
  ).getAttribute('src')

/** Every page starts on the first story photo, not a random one. */
const expectFirstStoryPhoto = async () => {
  const [first] = STORY_PHOTOS
  expect(await shownPhoto()).toBe(new URL(first?.sizes[0]?.url ?? '', location.href).href)
  expect(screen.getByText(first?.location ?? '')).toBeTruthy()
}

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('the page stories', () => {
  it('give a new install the welcome over the photo', async () => {
    await seedPage(PAGE_SEEDS.newInstall)
    render(<App />)

    expect(await screen.findByRole('dialog', { name: 'Welcome to Lander' })).toBeTruthy()
    await expectFirstStoryPhoto()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('give a settled install the clock and the photo, and nothing else', async () => {
    await seedPage(PAGE_SEEDS.settledInstall)
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
    await expectFirstStoryPhoto()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weather' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('give Weather on the reading it is seeded with', async () => {
    await seedPage(PAGE_SEEDS.weatherOn)
    render(<App />)

    const weather = await screen.findByRole('region', { name: 'Weather' })
    expect(weather.textContent).toContain('13°')
    await expectFirstStoryPhoto()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('give an updated install the weather news', async () => {
    await seedPage(PAGE_SEEDS.weatherNews)
    render(<App />)

    const note = await screen.findByRole('note')
    expect(note.textContent).toContain('New: weather')
    await expectFirstStoryPhoto()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weather' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
