import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

// The guided tour a new install is offered by the welcome: Edit, move and resize, options, the
// setup button when a widget is waiting for one, Add, Done, then Photos and Font in the settings
// panel. Run through the whole page with the real storage items; the test DOM has no layout.

/** The seeds a tour starts from: a new install, which is the Clock alone. */
const NEW_INSTALL = PAGE_SEEDS.newInstall

/** A window whose reduced-motion setting is `reduced`: the page's other media queries are off. */
const motion = (reduced: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: () => {},
    matches: reduced && query.includes('prefers-reduced-motion'),
    removeEventListener: () => {},
  }))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  // Nothing fades, so a press acts at once (the fade has its own test below).
  motion(true)
  // The test DOM has no layout: everything is drawn at one place, enough to be found.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

const note = () => screen.getByRole('note')
const title = () => note().querySelector('strong')?.textContent
const progress = () => note().querySelector('.callout__progress')?.textContent
const press = (name: string) => fireEvent.click(within(note()).getByRole('button', { name }))
const editing = () => screen.queryByRole('button', { name: 'Done' }) !== null
const addMenu = () => screen.queryByRole('menu', { name: 'Add a widget' })

/** What the synced storage held before the page was drawn: the seed's. */
let seeded: Record<string, unknown> = {}

/** Renders the page for a seed and starts the tour from the welcome. */
async function startTour(seed: Parameters<typeof seedPage>[0] = NEW_INSTALL) {
  await seedPage(seed)
  seeded = await fakeBrowser.storage.sync.get(null)
  const view = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Show me around' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Welcome to Lander' })).toBeNull(),
  )
  await screen.findByRole('note')
  return view
}

/** Presses Next until the note has this title. */
async function nextUntil(wanted: string) {
  for (let step = 0; step < 10 && title() !== wanted; step += 1) {
    press('Next')
    await act(async () => {})
  }
  expect(title()).toBe(wanted)
}

describe('the guided tour, from the welcome of a new install', () => {
  it('starts at the Edit button, outside edit mode, with nothing opened and no settings panel', async () => {
    await startTour()

    expect(title()).toBe('Edit your page')
    expect(progress()).toBe('1 of 7')
    expect(note().classList.contains('callout--beside')).toBe(true)
    expect(note().dataset.side).toBe('above')
    expect(editing()).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    expect((await onboardingItem.getValue())?.welcomed).toBe(true)
  })

  it('is before the Grid and the Bottom bar in the Tab order', async () => {
    const { container } = await startTour()

    const grid = await waitFor(() => {
      const found = container.querySelector('.grid')
      if (!found) throw new Error('no Grid yet')
      return found
    })
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(note().compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(note().compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('puts focus on its Next button when the welcome closes and leaves focus nowhere', async () => {
    await startTour()

    // The welcome was a modal: closing it drops focus to the page, and the note is before the
    // Grid and the Bottom bar, so a keyboard would start after it. Next is where it carries on.
    expect(document.activeElement).toBe(within(note()).getByRole('button', { name: 'Next' }))
  })

  it('goes through every stop in order, doing each thing for the person', async () => {
    await startTour()
    const seen: [title: string | undefined, progress: string | undefined, editing: boolean][] = []
    const look = () => seen.push([title(), progress(), editing()])

    look()
    for (let step = 0; step < 5; step += 1) {
      press('Next')
      await act(async () => {})
      look()
    }

    expect(seen).toEqual([
      ['Edit your page', '1 of 7', false],
      ['Move and resize', '2 of 7', true],
      ['Options', '3 of 7', true],
      ['Add a widget', '4 of 7', true],
      ['When you are done', '5 of 7', true],
      // Done is Next's work: edit mode is left and the panel's own stops are next.
      ['Photos', '6 of 7', false],
    ])
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
  })

  it('points the stops at the Clock, its options, the Add menu’s first item and the Done button', async () => {
    const { container } = await startTour()
    // Where the note sits is placeBeside's business; which thing it is beside is the question.
    // The test DOM draws everything at one place, so the note is told apart by its pointer's
    // side being set, and the target by what the page has when the stop is up.
    const has = (target: string) =>
      container.querySelector(`[data-callout-target="${target}"]`) !== null

    expect(has('edit')).toBe(true)
    await nextUntil('Move and resize')
    expect(has('widget:clock')).toBe(true)
    await nextUntil('Options')
    expect(has('options')).toBe(true)
    await nextUntil('Add a widget')
    // The menu is open by itself, and the note is beside its first item, not the Add button.
    expect(has('menu:clock')).toBe(true)
    await nextUntil('When you are done')
    expect(screen.getByRole('button', { name: 'Done' }).getAttribute('data-callout-target')).toBe(
      'edit',
    )
  })

  it('opens the Add menu by itself on the Add stop and shuts it on Next, with focus staying on Next', async () => {
    await startTour()
    const next = within(note()).getByRole('button', { name: 'Next' })
    next.focus()

    await nextUntil('Options')
    expect(addMenu()).toBeNull()
    press('Next')
    await act(async () => {})

    expect(title()).toBe('Add a widget')
    expect(addMenu()).not.toBeNull()
    expect(within(note()).getByRole('button', { name: 'Next' })).toBe(next)
    expect(document.activeElement).toBe(next)

    press('Next')
    await act(async () => {})

    expect(title()).toBe('When you are done')
    expect(addMenu()).toBeNull()
    expect(editing()).toBe(true)
    expect(document.activeElement).toBe(next)
  })

  it('keeps its note and the Add menu when the note is pressed with a pointer on the Add stop', async () => {
    await startTour()
    await nextUntil('Add a widget')
    const next = within(note()).getByRole('button', { name: 'Next' })

    // A press goes down before it is a click: it must not take the menu, and the note beside it,
    // away from under the pointer.
    fireEvent.pointerDown(next)
    await act(async () => {})

    expect(addMenu()).not.toBeNull()
    expect(title()).toBe('Add a widget')
    expect(next.isConnected).toBe(true)

    fireEvent.click(next)
    await act(async () => {})
    expect(title()).toBe('When you are done')
    expect(addMenu()).toBeNull()
  })

  it('keeps focus on the same Next button from stop to stop', async () => {
    await startTour()
    const next = within(note()).getByRole('button', { name: 'Next' })
    next.focus()

    for (const wanted of ['Move and resize', 'Options', 'Add a widget', 'When you are done']) {
      press('Next')
      await act(async () => {})
      expect(title()).toBe(wanted)
      expect(document.activeElement).toBe(next)
    }
  })

  it('says in the Add stop that a widget may need something from the person, when no stop has it', async () => {
    await startTour()

    await nextUntil('Add a widget')

    expect(note().textContent).toContain('needs something from you')
  })

  it('goes on to the settings panel on the last page stop: edit mode off, Photos then Font', async () => {
    await startTour()

    await nextUntil('When you are done')
    press('Next')
    await act(async () => {})

    const settings = await screen.findByRole('dialog', { name: 'Settings' })
    expect(editing()).toBe(false)
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('false')
    // The page's note is gone; the panel draws its own.
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(within(settings).getByRole('note').textContent).toContain('6 of 7')
    expect(within(settings).getByRole('note').textContent).toContain('Photos')

    fireEvent.click(within(settings).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    expect(within(settings).getByRole('note').textContent).toContain('7 of 7')
    expect(within(settings).getByRole('note').textContent).toContain('Font')

    fireEvent.click(within(settings).getByRole('button', { name: 'Done' }))
    await act(async () => {})
    expect(within(settings).queryByRole('note')).toBeNull()
  })

  it('writes nothing to the Layout or the settings, and the record only gains welcomed', async () => {
    await startTour()

    await nextUntil('Photos')
    const settings = screen.getByRole('dialog', { name: 'Settings' })
    fireEvent.click(within(settings).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    fireEvent.click(within(settings).getByRole('button', { name: 'Done' }))
    await act(async () => {})

    const stored = await fakeBrowser.storage.sync.get(null)
    expect(stored.layout).toBeUndefined()
    expect(stored.settings).toEqual(seeded.settings)
    expect(stored.onboarding).toEqual({ dismissed: ['layout'], welcomed: true })
    expect(Object.keys(stored).sort()).toEqual(['onboarding', 'settings'])
  })

  it('makes no request while it runs', async () => {
    await startTour()

    await nextUntil('Photos')

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('is left unfinished by the Dismiss button: edit mode and the menu are put back, nothing else is stored', async () => {
    await startTour()
    await nextUntil('Add a widget')
    expect(addMenu()).not.toBeNull()

    fireEvent.click(within(note()).getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})

    expect(screen.queryByRole('note')).toBeNull()
    expect(addMenu()).toBeNull()
    expect(editing()).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    const stored = await fakeBrowser.storage.sync.get(null)
    expect(stored.layout).toBeUndefined()
    expect(stored.settings).toEqual(seeded.settings)
    expect(stored.onboarding).toEqual({ dismissed: ['layout'], welcomed: true })
  })

  it('puts focus on the Edit button when it is dismissed from the keyboard', async () => {
    await startTour()
    await nextUntil('Options')
    within(note()).getByRole('button', { name: 'Dismiss' }).focus()

    fireEvent.click(within(note()).getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit' }))
  })

  it('ends when edit mode is left by hand, and leaves nothing on', async () => {
    await startTour()
    await nextUntil('Options')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await act(async () => {})

    expect(screen.queryByRole('note')).toBeNull()
    expect(editing()).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
  })

  it('ends when Escape leaves edit mode, with the Add menu shut', async () => {
    await startTour()
    await nextUntil('Add a widget')

    fireEvent.keyDown(window, { key: 'Escape' })
    await act(async () => {})

    expect(screen.queryByRole('note')).toBeNull()
    expect(editing()).toBe(false)
    expect(addMenu()).toBeNull()
  })

  it('ends when Settings is opened from the gear, and edit mode goes with it', async () => {
    await startTour()
    await nextUntil('Options')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await act(async () => {})

    const settings = await screen.findByRole('dialog', { name: 'Settings' })
    expect(screen.queryAllByRole('note')).toHaveLength(0)
    expect(within(settings).queryByRole('note')).toBeNull()
    expect(editing()).toBe(false)
  })

  it('moves on to the next stop when Edit is pressed by hand on the first', async () => {
    await startTour()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await act(async () => {})

    expect(title()).toBe('Move and resize')
    expect(progress()).toBe('2 of 7')
    // The person's edit mode is theirs: dismissing the tour leaves it on.
    fireEvent.click(within(note()).getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})
    expect(editing()).toBe(true)
  })

  it('does not hold the news back from, or show it with, the tour: a new install has none', async () => {
    await startTour()

    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(title()).not.toBe('You can edit your page now')
  })

  it('fades a note out before acting on Next, and acts at once with reduced motion', async () => {
    motion(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      await startTour()

      press('Next')
      expect(note().classList.contains('callout--leaving')).toBe(true)
      expect(title()).toBe('Edit your page')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })

      expect(title()).toBe('Move and resize')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the tour for a page that has a widget waiting for setup', () => {
  it('has a stop of its own for the setup button, and the Add stop does not repeat it', async () => {
    await startTour(PAGE_SEEDS.tourWeatherWaiting)

    expect(progress()).toBe('1 of 8')
    await nextUntil('Move and resize')
    await nextUntil('Set up a widget')
    expect(progress()).toBe('4 of 8')
    expect(document.querySelector('[data-callout-target="setup"]')).not.toBeNull()

    await nextUntil('Add a widget')
    expect(progress()).toBe('5 of 8')
    expect(note().textContent).not.toContain('needs something from you')
  })

  it('does not press the setup button for the person: nothing is asked of the browser or sent', async () => {
    await startTour(PAGE_SEEDS.tourWeatherWaiting)

    await nextUntil('Photos')

    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    const stored = await fakeBrowser.storage.sync.get(null)
    expect(stored.settings).toEqual(seeded.settings)
    expect(stored.layout).toBeUndefined()
    // The setup button is still there, unpressed.
    expect(document.querySelector('[data-callout-target="setup"]')).not.toBeNull()
  })
})

describe('the tour for a page with the Clock and a Weather', () => {
  it('points the move and resize stop at the first widget in the order of the page, the Weather', async () => {
    await startTour(PAGE_SEEDS.tourClockAndWeather)

    expect(progress()).toBe('1 of 7')
    await nextUntil('Move and resize')
    expect(document.querySelector('[data-callout-target="widget:weather"]')).not.toBeNull()
    expect(document.querySelector('[data-callout-target="setup"]')).toBeNull()
    await nextUntil('Photos')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})

describe('the tour for an empty Grid', () => {
  it('leaves out the stops about a widget, and counts the ones left', async () => {
    await startTour(PAGE_SEEDS.tourEmptyGrid)

    expect(progress()).toBe('1 of 5')
    press('Next')
    await act(async () => {})
    expect(title()).toBe('Add a widget')
    expect(progress()).toBe('2 of 5')
    await nextUntil('Photos')
    expect(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('note').textContent,
    ).toContain('4 of 5')
  })
})

describe('who sees the tour', () => {
  it('is not shown when the welcome is skipped', async () => {
    await seedPage(NEW_INSTALL)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(screen.queryByRole('note')).toBeNull()
    expect(editing()).toBe(false)
  })

  it('is not shown to an update: it sees the note about the Layout, once', async () => {
    await seedPage(PAGE_SEEDS.layoutNewsClockAndWeather)
    render(<App />)

    const shown = await screen.findByRole('note')
    expect(within(shown).getByText('You can edit your page now')).toBeTruthy()
    expect(within(shown).queryByText(/of \d/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show me around' })).toBeNull()
  })

  it('is not shown on a later tab, after it ran once', async () => {
    const { unmount } = await startTour()
    fireEvent.click(within(note()).getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})
    unmount()

    render(<App />)
    await screen.findByRole('button', { name: 'Edit' })
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
