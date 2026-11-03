import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'

import * as stories from './OptionsPopover.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

/** What each story opens, as its `play` does: the Widget whose Options button it presses. */
const OPENS: Record<StoryName, string> = {
  ClockBeside: 'Clock',
  NarrowWindow: 'Weather',
  ShortWindow: 'Weather',
  WeatherBeside: 'Weather',
  WeatherFlipped: 'Weather',
}

/** What the popover of each is called: its box's name, with the place for a Weather. */
const DIALOGS: Record<string, string> = {
  Clock: 'Clock options',
  Weather: 'Weather, Victoria options',
}

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the options popover stories', () => {
  it.each(Object.entries(OPENS))(
    '%s seeds a page whose %s options open, with nothing fetched',
    async (name, widget) => {
      const story = stories[name as StoryName] as { beforeEach: () => Promise<() => void> }
      // The story's own `beforeEach` stands in for the network (see its `sendNothing`), so the
      // test's spy is put back over it: what is asked for is what reaches `fetch`.
      const restore = await story.beforeEach()
      restore()
      vi.stubGlobal('fetch', fetchSpy)
      render(<App />)

      fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
      fireEvent.click(await screen.findByRole('button', { name: `${widget} options` }))

      await waitFor(() =>
        expect(screen.getByRole('dialog', { name: DIALOGS[widget] })).toBeTruthy(),
      )
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )

  it('put the Weather of WeatherBeside at column 2, row 2, with room on its right', async () => {
    const story = stories.WeatherBeside as unknown as { beforeEach: () => Promise<() => void> }
    ;(await story.beforeEach())()
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('[data-widget="weather"]')).not.toBeNull())
    const box = container.querySelector<HTMLElement>('[data-widget="weather"]')
    expect([box?.style.gridColumn, box?.style.gridRow]).toEqual(['2 / span 2', '2 / span 2'])
  })
})
