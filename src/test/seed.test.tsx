import { render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'
import { DEFAULT_SETTINGS } from '@/settings/schema'

import { makePlace, makeWeather, STORY_PHOTOS } from './fixtures'
import { seedPage } from './seed'

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

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('seedPage', () => {
  it('gives a new install the welcome, and nothing is fetched', async () => {
    await seedPage({ pending: { dismissed: ['weather'], welcomed: false } })
    render(<App />)

    expect(await screen.findByRole('dialog', { name: 'Welcome to Lander' })).toBeTruthy()
    expect(await shownPhoto()).toContain('/story-photos/')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('gives a settled install the clock and the photo, and nothing else', async () => {
    await seedPage({ onboarding: { dismissed: ['weather'], welcomed: true } })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
    expect(await shownPhoto()).toContain('/story-photos/')
    expect(await screen.findByText(STORY_PHOTOS[0]?.location ?? '')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Weather' })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('gives Weather on the reading it is seeded with', async () => {
    const place = makePlace()
    await seedPage({
      onboarding: { dismissed: ['weather'], welcomed: true },
      settings: {
        ...DEFAULT_SETTINGS,
        weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place, unit: 'celsius' },
      },
      weather: makeWeather({ temperature: 13.4 }),
    })
    render(<App />)

    const weather = await screen.findByRole('region', { name: 'Weather' })
    expect(weather.textContent).toContain('13°')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('gives an updated install the weather news', async () => {
    await seedPage({ onboarding: { dismissed: [], welcomed: true } })
    render(<App />)

    const note = await screen.findByRole('note')
    expect(note.textContent).toContain('New: weather')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
