import { render, screen, waitFor } from '@testing-library/preact'
import type { VNode } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as stories from './Callout.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

/** What each story points at, and the part of the page it needs drawn for the pointing. */
const POINTS_AT: Record<StoryName, string> = {
  BesideAddItem: '[data-callout-target="menu:clock"]',
  BesideEdit: '[data-callout-target="edit"]',
  BesideWidget: '[data-callout-target="widget:weather"]',
}

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
  // The test DOM has no layout: everything is drawn at one place, enough to be found.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(100, 100, 40, 40),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the callout stories', () => {
  it.each(Object.entries(POINTS_AT))(
    '%s draws a callout beside its target, with nothing fetched',
    async (name, selector) => {
      const story = stories[name as StoryName] as unknown as {
        beforeEach: () => Promise<() => void>
        render: () => VNode
      }
      // The story's own `beforeEach` stands in for the network (see its `sendNothing`), so the
      // test's spy is put back over it: what is asked for is what reaches `fetch`.
      const restore = await story.beforeEach()
      restore()
      vi.stubGlobal('fetch', fetchSpy)
      const { container } = render(story.render())

      await waitFor(() => expect(container.ownerDocument.querySelector(selector)).not.toBeNull())
      const note = await screen.findByRole('note')
      expect(note.classList.contains('callout--beside')).toBe(true)
      expect(note.dataset.side).toBeTruthy()
      expect(fetchSpy).not.toHaveBeenCalled()
    },
  )
})
