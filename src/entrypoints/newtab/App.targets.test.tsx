import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { CalloutInfo } from '@/onboarding/callouts'
import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

// The news the page is told about. `callouts.ts` has none that point at the page yet (a later
// change adds them), so the tests bring their own, as the page would get them.
const news = vi.hoisted(() => ({ current: [] as CalloutInfo[] }))
vi.mock('@/onboarding/callouts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/onboarding/callouts')>()
  return {
    ...original,
    get NEWS() {
      return news.current
    },
  }
})

const AT_EDIT: CalloutInfo = {
  body: 'Edit the page here.',
  id: 'at-edit',
  target: 'edit',
  title: 'Edit mode',
}

/**
 * The test DOM has no layout: every element is drawn where the Bottom bar's Edit button is, which
 * is enough for a callout to find its target and sit above it.
 */
const draw = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  // A page that has been seen before: no welcome, and the Clock and the Weather on the Grid.
  await seedPage({
    ...PAGE_SEEDS.gridUpdatedClockAndWeather,
    onboarding: { dismissed: [], welcomed: true },
  })
  draw()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  news.current = []
  document.documentElement.removeAttribute('style')
})

describe('App, with news that points at the page', () => {
  it('puts the news beside the Edit button, once the page has drawn it', async () => {
    news.current = [AT_EDIT]
    render(<App />)

    const note = await screen.findByRole('note')
    expect(note.textContent).toContain('Edit mode')
    expect(note.classList.contains('callout--beside')).toBe(true)
    expect(note.dataset.side).toBe('above')
    // Above the button, clear of it: the button is at 834 and the note 140 tall, 12 away.
    expect(note.style.top).toBe(`${834 - 12 - 140}px`)
  })

  it('is before the Grid and the Bottom bar in the Tab order, and takes no focus', async () => {
    news.current = [AT_EDIT]
    const { container } = render(<App />)

    const note = await screen.findByRole('note')
    const grid = await waitFor(() => {
      const found = container.querySelector('.grid')
      if (!found) throw new Error('no Grid yet')
      return found
    })
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(note.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note.contains(document.activeElement)).toBe(false)
  })

  it('is dismissed with its button, and kept dismissed', async () => {
    news.current = [AT_EDIT]
    const { unmount } = render(<App />)

    fireEvent.click(within(await screen.findByRole('note')).getByRole('button', { name: 'Got it' }))

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect((await onboardingItem.getValue())?.dismissed).toEqual(['at-edit'])

    unmount()
    render(<App />)
    await screen.findByRole('button', { name: 'Edit' })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('is dismissed with the Dismiss as well, and only adds its id', async () => {
    news.current = [AT_EDIT]
    await onboardingItem.setValue({ dismissed: ['seen-before'], welcomed: true })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))

    await waitFor(async () =>
      expect(await onboardingItem.getValue()).toEqual({
        dismissed: ['seen-before', 'at-edit'],
        welcomed: true,
      }),
    )
  })

  it('is not drawn when its target is not on the page, and is not used up', async () => {
    news.current = [{ ...AT_EDIT, id: 'at-date', target: 'widget:date' }]
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.widget-box')).not.toBeNull())
    // Long enough for the availability check to have answered.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('note')).toBeNull()
    expect((await onboardingItem.getValue())?.dismissed).toEqual([])
  })

  it('points at a Widget, found by its type', async () => {
    news.current = [{ ...AT_EDIT, id: 'at-weather', target: 'widget:weather' }]
    render(<App />)

    const note = await screen.findByRole('note')
    expect(note.dataset.side).toBe('right')
  })

  it('waits for what only edit mode draws, and goes when edit mode does', async () => {
    news.current = [{ ...AT_EDIT, id: 'at-options', target: 'options' }]
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.widget-box')).not.toBeNull())
    expect(screen.queryByRole('note')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await screen.findByRole('note')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect((await onboardingItem.getValue())?.dismissed).toEqual([])
  })

  it('is out of the way while settings are open, as news is', async () => {
    news.current = [AT_EDIT]
    render(<App />)
    await screen.findByRole('note')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    await screen.findByRole('dialog', { name: 'Settings' })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('writes only the id it was dismissed by: nothing else of the synced settings', async () => {
    news.current = [AT_EDIT]
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(set).toHaveBeenCalled())

    const keys = set.mock.calls.flatMap(([items]) => Object.keys(items))
    expect(new Set(keys)).toEqual(new Set(['onboarding']))
  })
})
