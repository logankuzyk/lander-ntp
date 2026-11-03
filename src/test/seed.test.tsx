import { render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'

import { STORY_PHOTOS } from './fixtures'
import { PAGE_SEEDS, seedPage, weatherBoxRect, type WeatherBoxSize, weatherStateSeed } from './seed'

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

/** Each box on the page as [type, column, row]: where CSS grid is told to put it. */
const boxes = (container: ParentNode) =>
  [...container.querySelectorAll<HTMLElement>('.widget-box')].map((box) => [
    box.dataset.widget,
    box.style.gridColumn,
    box.style.gridRow,
  ])

describe('the Grid stories', () => {
  it('give a new install the Clock in the middle, and nothing else', async () => {
    await seedPage(PAGE_SEEDS.gridNewInstall)
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    expect(boxes(container)).toEqual([['clock', '5 / span 4', '4 / span 2']])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('give an updated user the Weather in the top right corner and the Clock where it was', async () => {
    await seedPage(PAGE_SEEDS.gridUpdatedClockAndWeather)
    const { container } = render(<App />)

    const weather = await screen.findByRole('region', { name: 'Weather' })
    expect(weather.textContent).toContain('13°')
    expect(boxes(container)).toEqual([
      ['weather', '11 / span 2', '1 / span 2'],
      ['clock', '5 / span 4', '4 / span 2'],
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('give the Clock with seconds six columns, from column 4', async () => {
    await seedPage(PAGE_SEEDS.gridClockWithSeconds)
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    expect(boxes(container)).toEqual([['clock', '4 / span 6', '4 / span 2']])
    expect(container.querySelector('.clock__time')?.textContent).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
  })

  it('give an empty Grid when the Clock and the Weather are off', async () => {
    await seedPage(PAGE_SEEDS.gridEmpty)
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    expect(boxes(container)).toEqual([])
  })

  it('give eight Widgets from a stored Layout, each Weather with its reading', async () => {
    await seedPage(PAGE_SEEDS.gridEightWidgets)
    const { container } = render(<App />)

    await waitFor(() => expect(screen.getAllByRole('region', { name: 'Weather' })).toHaveLength(4))
    expect(boxes(container)).toHaveLength(8)
    expect(container.querySelectorAll('.clock')).toHaveLength(4)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// Last, because a Weather left loading keeps its request under way for the rest of the file.
describe('the Weather state stories', () => {
  const SIZES: WeatherBoxSize[] = ['smallest', 'starting', 'largest']
  const panel = () => document.querySelector('.widget-state')

  it('put the Weather in the top right corner at each of its sizes, the largest bigger than the smallest', () => {
    const smallest = weatherBoxRect('smallest')
    const starting = weatherBoxRect('starting')
    const largest = weatherBoxRect('largest')
    for (const rect of [smallest, starting, largest]) {
      expect(rect.row).toBe(1)
      expect(rect.col + rect.w).toBe(13)
    }
    expect(starting.w).toBeGreaterThanOrEqual(smallest.w)
    expect(largest.w * largest.h).toBeGreaterThan(smallest.w * smallest.h)
  })

  it.each(SIZES)(
    'give a Weather that is switched off the off panel at %s, asking nothing',
    async (size) => {
      await seedPage(weatherStateSeed('off', size))
      const { container } = render(<App />)

      await waitFor(() => expect(panel()?.getAttribute('data-state')).toBe('off'))
      expect(panel()?.textContent).toBe('WeatherSwitched off for now')
      const { col, h, row, w } = weatherBoxRect(size)
      expect(boxes(container)).toEqual([['weather', `${col} / span ${w}`, `${row} / span ${h}`]])
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it.each(SIZES)(
    'give a Weather that cannot reach the forecast the failed panel at %s',
    async (size) => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
      await seedPage(weatherStateSeed('failed', size))
      const { container } = render(<App />)

      await waitFor(() => expect(panel()?.getAttribute('data-state')).toBe('failed'))
      expect(panel()?.textContent).toBe("WeatherCan't reach the forecast")
      const { col, h, row, w } = weatherBoxRect(size)
      expect(boxes(container)).toEqual([['weather', `${col} / span ${w}`, `${row} / span ${h}`]])
    },
  )

  it.each(SIZES)(
    'give a Weather that is loading the loading panel at %s, after a moment',
    async (size) => {
      let release!: (response: unknown) => void
      fetchSpy.mockReturnValue(new Promise((resolve) => (release = resolve)))
      try {
        await seedPage(weatherStateSeed('loading', size))
        const { container } = render(<App />)

        await waitFor(() => expect(container.querySelector('.widget-box')).not.toBeNull())
        expect(panel()).toBeNull()
        await waitFor(() => expect(panel()?.getAttribute('data-state')).toBe('loading'))
        expect(panel()?.textContent).toBe('WeatherLoading')
        const { col, h, row, w } = weatherBoxRect(size)
        expect(boxes(container)).toEqual([['weather', `${col} / span ${w}`, `${row} / span ${h}`]])
      } finally {
        // Let the request end, so it is not left under way for the next test of this place.
        release({ ok: false })
      }
    },
  )
})
