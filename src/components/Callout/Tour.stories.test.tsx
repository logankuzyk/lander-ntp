import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './Tour.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

type Seeded = { beforeEach: () => Promise<(() => void) | void> }

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: () => {},
    matches: query.includes('prefers-reduced-motion'),
    removeEventListener: () => {},
  }))
  // The test DOM has no layout: everything is drawn at one place, enough to be found.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

/** Seeds a story's storage as Storybook does, with a stand-in for the network put back after. */
async function seed(name: StoryName) {
  const restore = await (stories[name] as unknown as Seeded).beforeEach()
  if (restore) restore()
  vi.stubGlobal('fetch', fetchSpy)
}

const title = () => screen.queryByRole('note')?.querySelector('strong')?.textContent
const progress = () => screen.queryByRole('note')?.querySelector('.callout__progress')?.textContent

/** What a story's `play` does: answer the welcome, then Next until the stop. */
async function takeTour(stop?: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Show me around' }))
  await screen.findByRole('note')
  for (let presses = 0; stop !== undefined && title() !== stop && presses < 10; presses += 1) {
    fireEvent.click(screen.getByRole('note').querySelector('.callout__action') ?? document.body)
    await act(async () => {})
  }
}

const STOPS = [
  ['Edit', 'Edit your page', '1 of 7'],
  ['MoveAndResize', 'Move and resize', '2 of 7'],
  ['Options', 'Options', '3 of 7'],
  ['AddStop', 'Add a widget', '4 of 7'],
  ['Done', 'When you are done', '5 of 7'],
  ['BackgroundStop', 'Background', '6 of 7'],
  ['Font', 'Font', '7 of 7'],
  ['Setup', 'Set up a widget', '4 of 8'],
  ['ClockAndWeather', 'Move and resize', '2 of 7'],
  ['EmptyGrid', 'Add a widget', '2 of 5'],
  ['NewerLayout', 'Edit your page', '1 of 4'],
] as const

describe('the tour stories', () => {
  it.each(STOPS)(
    '%s is reached by Show me around and Next: %s, %s',
    async (name, wanted, count) => {
      await seed(name)
      render(<App />)

      await takeTour(wanted)

      expect(title()).toBe(wanted)
      expect(progress()).toBe(count)
      if (name === 'AddStop') {
        expect(screen.getByRole('note').textContent).toContain(
          'The Date, Analog clock, Bookmarks and Quick dial are in the same menu. A Quick dial is one site; add one for each.',
        )
      }
      if (name === 'MoveAndResize') {
        expect(screen.getByRole('note').textContent).toContain(
          'Drag a widget to move it, and drag the handle in its corner to resize it.',
        )
        expect(screen.getByRole('note').textContent).not.toMatch(
          /keyboard|\bE\b|Tab|Enter|arrow|Shift/i,
        )
      }
      if (name === 'BackgroundStop') {
        expect(screen.getByRole('note').textContent).toContain(
          'Choose how often the photo changes, which tags to draw from, or a solid colour. Pick a photo from the gallery to show it now. The heart in photo details keeps favourites, and Favourites only cycles just those.',
        )
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it('Welcome is the welcome of a new install, with no note and nothing fetched', async () => {
    await seed('Welcome')
    render(<App />)

    expect(await screen.findByRole('dialog', { name: 'Welcome to Lander' })).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('Add has the menu open by itself', async () => {
    await seed('AddStop')
    render(<App />)

    await takeTour('Add a widget')

    expect(screen.getByRole('menu', { name: 'Add a widget' })).toBeTruthy()
  })

  it('SkippedWelcome has no note after Skip', async () => {
    await seed('SkippedWelcome')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('DismissedMidTour has no note and no edit mode after Dismiss', async () => {
    await seed('DismissedMidTour')
    render(<App />)
    await takeTour('Options')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})

    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('has a story for every stop of the tour', () => {
    expect(Object.keys(stories).filter((name) => name !== 'default')).toEqual(
      expect.arrayContaining(['Welcome', ...STOPS.slice(0, 7).map(([name]) => name)]),
    )
  })
})
