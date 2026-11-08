import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem } from '@/onboarding/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { device } from '@/test/permissions'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import { App } from './App'

// The guided tour a new install is offered by the welcome: Edit, move and resize, options, the
// setup button when a widget is waiting for one, Add, Done, then Background and Font in the settings
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
async function startTour(
  seed: Parameters<typeof seedPage>[0] = NEW_INSTALL,
  also?: () => Promise<void>,
) {
  await seedPage(seed)
  await also?.()
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

  it('shows only dragging instructions at Move and resize', async () => {
    await startTour()
    await nextUntil('Move and resize')

    expect(note().textContent).toContain(
      'Drag a widget to move it, and drag the handle in its corner to resize it.',
    )
    expect(note().textContent).not.toMatch(/keyboard|\bE\b|Tab|Enter|arrow|Shift/i)
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
      ['Background', '6 of 7', false],
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
    expect(within(settings).getByRole('note').textContent).toContain('Background')

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

    await nextUntil('Background')
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

    await nextUntil('Background')

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

  it('is over when edit mode is left by hand: going back into it does not bring the tour back', async () => {
    await startTour()
    await nextUntil('Options')
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await act(async () => {})

    // E enters edit mode again, as it would for anyone: the tour is not in it.
    fireEvent.keyDown(window, { key: 'e' })
    await act(async () => {})
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(editing()).toBe(true)
    expect(screen.queryByRole('note')).toBeNull()
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

  it('does not start again from the first stop when the settings that ended it are closed', async () => {
    await startTour()
    await nextUntil('Options')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByRole('dialog', { name: 'Settings' })

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    await act(async () => {})
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(screen.queryByRole('note')).toBeNull()
    expect(editing()).toBe(false)
  })

  describe('where focus goes when the run ends, so that a keyboard is not dropped on the page', () => {
    const editButton = () => screen.getByRole('button', { name: 'Edit' })

    it('is the Edit button after Escape', async () => {
      await startTour()
      await nextUntil('Options')
      expect(note().contains(document.activeElement)).toBe(true)

      fireEvent.keyDown(window, { key: 'Escape' })
      await act(async () => {})

      expect(screen.queryByRole('note')).toBeNull()
      expect(document.activeElement).toBe(editButton())
    })

    it('is the Edit button after E', async () => {
      await startTour()
      await nextUntil('Add a widget')

      fireEvent.keyDown(window, { key: 'e' })
      await act(async () => {})

      expect(document.activeElement).toBe(editButton())
    })

    it('is the Edit button after Done is pressed with focus still in the note', async () => {
      await startTour()
      await nextUntil('Options')

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      await act(async () => {})

      expect(document.activeElement).toBe(editButton())
    })

    it('is the settings panel when the gear opened it: its Close button, as for any settings', async () => {
      await startTour()
      await nextUntil('Options')

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      await act(async () => {})

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
    })

    it('is left alone when it was on something else, such as the gear', async () => {
      await startTour()
      await nextUntil('Options')
      const photo = screen.getByRole('button', { name: 'Next photo' })
      photo.focus()

      fireEvent.keyDown(window, { key: 'Escape' })
      await act(async () => {})

      expect(document.activeElement).toBe(photo)
    })

    it('is the Next button of the settings panel as the page’s stops end, then its Close button once the panel’s stops end', async () => {
      await startTour()
      await nextUntil('Background')
      const panel = screen.getByRole('dialog', { name: 'Settings' })
      expect(document.activeElement).toBe(within(panel).getByRole('button', { name: 'Next' }))

      fireEvent.click(within(panel).getByRole('button', { name: 'Next' }))
      await act(async () => {})
      expect(title()).toBe('Font')
      fireEvent.click(within(panel).getByRole('button', { name: 'Done' }))
      await act(async () => {})

      expect(within(panel).queryByRole('note')).toBeNull()
      expect(document.activeElement).toBe(
        within(panel).getByRole('button', { name: 'Close settings' }),
      )
    })

    it('is the Close button of the settings panel when its stops are dismissed', async () => {
      await startTour()
      await nextUntil('Background')
      const panel = screen.getByRole('dialog', { name: 'Settings' })

      fireEvent.click(within(panel).getByRole('button', { name: 'Dismiss' }))
      await act(async () => {})

      expect(document.activeElement).toBe(
        within(panel).getByRole('button', { name: 'Close settings' }),
      )
    })
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

describe('the tour after the person pressed Edit themselves on the first stop', () => {
  /** Edit pressed by hand moves the tour on to the second stop: that edit mode is theirs. */
  async function startAfterEdit() {
    await startTour()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await act(async () => {})
    expect(title()).toBe('Move and resize')
  }

  it('still shuts the Add menu when it is dismissed on the Add stop, and leaves their edit mode on', async () => {
    await startAfterEdit()
    await nextUntil('Add a widget')
    expect(addMenu()).not.toBeNull()

    fireEvent.click(within(note()).getByRole('button', { name: 'Dismiss' }))
    await act(async () => {})

    expect(screen.queryByRole('note')).toBeNull()
    expect(addMenu()).toBeNull()
    expect(editing()).toBe(true)
  })

  it('still leaves edit mode on Next at Done, as pressing Done would', async () => {
    await startAfterEdit()
    await nextUntil('When you are done')

    press('Next')
    await act(async () => {})

    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(title()).toBe('Background')
    expect(editing()).toBe(false)
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

  /**
   * Everything a setup button could do if the tour pressed it: ask the browser for a permission
   * (Firefox's consent), ask the device for its position, send a request, or open the Weather's
   * options at the place search. A tour through every page stop, then the settings panel's.
   */
  async function tourWithoutPressing(
    seed: Parameters<typeof seedPage>[0],
    position: PermissionState,
  ) {
    const phone = device(position)
    const permission = vi
      .spyOn(browser.permissions, 'request')
      .mockImplementation(() => Promise.resolve(false) as never)
    await startTour(seed)
    const optionsOpen = () => document.querySelector('.options-popover') !== null

    const asked: string[] = []
    for (let step = 0; step < 10 && title() !== 'Background'; step += 1) {
      // The setup button is on the page, waiting, at every stop.
      expect(document.querySelector('[data-callout-target="setup"]')).not.toBeNull()
      expect(optionsOpen()).toBe(false)
      asked.push(title() ?? '')
      press('Next')
      await act(async () => {})
    }

    expect(asked).toContain('Set up a widget')
    expect(title()).toBe('Background')
    expect(optionsOpen()).toBe(false)
    expect(permission).not.toHaveBeenCalled()
    expect(phone.getCurrentPosition).not.toHaveBeenCalled()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    const stored = await fakeBrowser.storage.sync.get(null)
    expect(stored.settings).toEqual(seeded.settings)
    expect(stored.layout).toBeUndefined()
    // Still unpressed once the tour is over.
    expect(document.querySelector('[data-callout-target="setup"]')).not.toBeNull()
  }

  it('does not press the setup button of a Weather waiting for a place: no options open, nothing asked or sent', async () => {
    await tourWithoutPressing(PAGE_SEEDS.tourWeatherWaiting, 'prompt')
  })

  it('does not press the setup button of a Weather waiting for the location: no prompt, no position, nothing sent', async () => {
    await tourWithoutPressing(
      {
        ...PAGE_SEEDS.tourWeatherWaiting,
        settings: {
          ...DEFAULT_SETTINGS,
          clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
          weather: { ...DEFAULT_SETTINGS.weather, enabled: true, followDevice: true },
        },
      },
      'prompt',
    )
  })
})

describe('the tour for a page with the Clock and a Weather', () => {
  it('points the move and resize stop at the first widget in the order of the page, the Weather', async () => {
    await startTour(PAGE_SEEDS.tourClockAndWeather)

    expect(progress()).toBe('1 of 7')
    await nextUntil('Move and resize')
    expect(document.querySelector('[data-callout-target="widget:weather"]')).not.toBeNull()
    expect(document.querySelector('[data-callout-target="setup"]')).toBeNull()
    await nextUntil('Background')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})

describe('the tour for a Layout that a newer version wrote, which cannot be changed', () => {
  const NEWER = {
    layout: {
      v: 2,
      widgets: [
        {
          col: 5,
          h: 2,
          id: 'clock0aa',
          options: { showDate: false, showSeconds: false },
          row: 4,
          type: 'clock',
          w: 4,
        },
      ],
    },
  }
  const startNewer = () =>
    startTour(NEW_INSTALL, async () => {
      await fakeBrowser.storage.sync.set(NEWER)
    })

  it('has only the stops that do not tell the person to change anything, and says to update', async () => {
    await startNewer()

    expect(progress()).toBe('1 of 4')
    expect(note().textContent).toContain('Update Lander to change it.')
    expect(note().textContent).not.toMatch(/keyboard|\bE\b|Tab|Enter|arrow|Shift/i)

    press('Next')
    await act(async () => {})
    expect(title()).toBe('When you are done')
    expect(progress()).toBe('2 of 4')
    expect(editing()).toBe(true)
    // There is no Add stop to open the menu, and no Add menu.
    expect(addMenu()).toBeNull()

    press('Next')
    await act(async () => {})
    expect(progress()).toBe('3 of 4')
    expect(title()).toBe('Background')
    expect(editing()).toBe(false)
    expect((await fakeBrowser.storage.sync.get('layout')).layout).toEqual(NEWER.layout)
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
    await nextUntil('Background')
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
