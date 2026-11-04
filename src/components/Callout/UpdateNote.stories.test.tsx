import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './UpdateNote.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

type Seeded = { beforeEach: () => Promise<(() => void) | void> }

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
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

describe('the update note stories', () => {
  it.each([
    ['ClockAndWeather', 1],
    ['ClockOnly', 1],
    ['WeatherOnly', 0],
    ['BothOff', 0],
  ] as const)(
    '%s draw the note at the Edit button, with %i Clock(s) and nothing fetched',
    async (name, clocks) => {
      await seed(name)
      const { container } = render(<App />)

      const note = await screen.findByRole('note')
      expect(note.textContent).toContain('You can edit your page now')
      expect(note.classList.contains('callout--beside')).toBe(true)
      await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
      expect(container.querySelectorAll('[data-callout-target="widget:clock"]')).toHaveLength(
        clocks,
      )
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it('BothOff has an empty Grid', async () => {
    await seed('BothOff')
    const { container } = render(<App />)

    await screen.findByRole('note')
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    expect(container.querySelector('.widget-box')).toBeNull()
  })

  it('AfterShowMe is reached by pressing Show me: edit mode, the note gone, Done focused', async () => {
    await seed('AfterShowMe')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show me' }))

    const done = await screen.findByRole('button', { name: 'Done' })
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(document.activeElement).toBe(done)
  })

  it('NewInstallNoNote has the welcome and, once it is skipped, no note', async () => {
    await seed('NewInstallNoNote')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('note')).toBeNull()
  })
})
