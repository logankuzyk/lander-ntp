import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { layoutItem } from '@/layout/storage'
import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

// The note about the Layout, with the news as it ships (App.targets.test.tsx brings its own).
// The four ways of updating from v0.2.3 and a new install; each is stored exactly as the page
// stories seed it.

const UPDATES = [
  ['the Clock and the Weather on', PAGE_SEEDS.layoutNewsClockAndWeather],
  ['the Clock on and the Weather off', PAGE_SEEDS.layoutNewsClockOnly],
  ['the Clock off and a Weather waiting for a place', PAGE_SEEDS.layoutNewsWeatherOnly],
  ['both off, an empty Grid', PAGE_SEEDS.layoutNewsBothOff],
] as const

/** The test DOM has no layout: everything is drawn where the Edit button is, above the foot. */
const draw = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  draw()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App, with the update note about the Layout', () => {
  it.each(UPDATES)('shows the note at the Edit button, updating with %s', async (_name, seed) => {
    await seedPage(seed)
    render(<App />)

    const note = await screen.findByRole('note')
    expect(within(note).getByText('You can edit your page now')).toBeTruthy()
    expect(note.classList.contains('callout--beside')).toBe(true)
    expect(note.dataset.side).toBe('above')
    expect(note.style.top).toBe(`${834 - 12 - 140}px`)
    expect(within(note).getByRole('button', { name: 'Show me' })).toBeTruthy()
    expect(within(note).queryByRole('button', { name: 'Got it' })).toBeNull()
  })

  it('is before the Grid and the Bottom bar in the Tab order, and takes no focus', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
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

  it('waits for the stored Layout before it is drawn, as the Grid does', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
    // The Layout arrives after the settings and the record: the note is placed by it.
    const read = layoutItem.read
    let arrive: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      arrive = resolve
    })
    vi.spyOn(layoutItem, 'read').mockImplementation(async () => {
      await held
      return read()
    })
    const { container } = render(<App />)

    await screen.findByRole('button', { name: 'Edit' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('note')).toBeNull()
    expect(container.querySelector('.grid')).toBeNull()

    arrive()

    await screen.findByRole('note')
    expect(container.querySelector('.grid')).not.toBeNull()
  })

  it('has "Show me" go into edit mode with focus on Done, and be dismissed for good', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
    const { unmount } = render(<App />)
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(
      within(await screen.findByRole('note')).getByRole('button', { name: 'Show me' }),
    )

    const done = await screen.findByRole('button', { name: 'Done' })
    expect(done.getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    expect(document.activeElement).toBe(done)
    await waitFor(async () =>
      expect((await onboardingItem.getValue())?.dismissed).toEqual(['layout']),
    )

    // Once each: another tab does not show it again.
    unmount()
    render(<App />)
    await screen.findByRole('button', { name: 'Edit' })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('is dismissed with its Dismiss button too, without going into edit mode', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsBothOff)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))

    await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
    await waitFor(async () =>
      expect((await onboardingItem.getValue())?.dismissed).toEqual(['layout']),
    )
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('draws an empty Grid for both off, and the note says Add brings widgets back', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsBothOff)
    const { container } = render(<App />)

    const note = await screen.findByRole('note')
    expect(container.querySelector('.widget-box')).toBeNull()
    expect(note.textContent).toContain('Add brings back any you had off')
  })

  it('adds only its id to a record that v0.2.3 stored, and writes nothing else', async () => {
    await seedPage({
      ...PAGE_SEEDS.layoutNewsClockAndWeather,
      onboarding: { dismissed: ['weather'], welcomed: true },
    })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show me' }))
    await vi.waitFor(async () =>
      expect(await onboardingItem.getValue()).toEqual({
        dismissed: ['weather', 'layout'],
        welcomed: true,
      }),
    )
    // Long enough for any other save (the settings' queue is a few milliseconds) to have gone.
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Entering edit mode is page state: nothing of the Layout or the settings is written.
    const keys = set.mock.calls.flatMap(([items]) => Object.keys(items))
    expect(new Set(keys)).toEqual(new Set(['onboarding']))
  })

  it('is not shown to a new install, before or after the welcome is answered', async () => {
    await seedPage(PAGE_SEEDS.newInstall)
    // As the background script records it (install.ts): the news already seen.
    expect(await onboardingItem.getValue()).toEqual({
      dismissed: ['layout', 'accounts'],
      welcomed: false,
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Welcome to Lander' })).toBeNull(),
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('note')).toBeNull()
    expect((await onboardingItem.getValue())?.dismissed).toEqual(['layout', 'accounts'])
  })

  it('is out of the way while settings are open, as news is', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockOnly)
    render(<App />)
    await screen.findByRole('note')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    await screen.findByRole('dialog', { name: 'Settings' })
    expect(screen.queryByRole('note')).toBeNull()
  })
})
