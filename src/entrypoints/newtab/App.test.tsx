import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem } from '@/onboarding/storage'
import { manifestCache, photoState } from '@/photos/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makeManifest, makePhoto } from '@/test/fixtures'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'

import { App } from './App'

/**
 * The photo on screen: the topmost background layer's full-resolution source. A replacement
 * photo is appended over the one it is cross-fading out, so the last layer is the current one.
 */
const currentPhotoSrc = async () =>
  (
    await waitFor(() => {
      const images = document.querySelectorAll<HTMLImageElement>('.background__full')
      const top = images[images.length - 1]
      if (!top) throw new Error('no photo rendered yet')
      return top
    })
  ).getAttribute('src')

const seedPhotos = () =>
  manifestCache.setValue({
    data: makeManifest([makePhoto('a'), makePhoto('b')]),
    etag: null,
    fetchedAt: Date.now(),
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

describe('App', () => {
  it('renders the clock', async () => {
    // <time> has no implicit ARIA role, so query the element directly.
    const { container } = render(<App />)

    // Nothing on the first paint: the clock waits for the stored settings rather than being
    // drawn from the defaults and corrected.
    expect(container.querySelector('time')).toBeNull()

    await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
    const clock = container.querySelector('time')
    expect(clock?.getAttribute('datetime')).toBeTruthy()
    expect(clock?.textContent).toMatch(/^\d{1,2}:\d{2}$/)
  })

  it('shows a cached photo and moves to the next one', async () => {
    await seedPhotos()
    render(<App />)

    const first = await currentPhotoSrc()
    // The → key is covered in Controls.test.tsx.
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    await waitFor(async () => expect(await currentPhotoSrc()).not.toBe(first))
    const stored = await photoState.getValue()
    expect(await currentPhotoSrc()).toContain(`/photos/${stored?.currentId}/`)
  })

  it('shows the bundled photo when offline with nothing cached', async () => {
    render(<App />)

    expect(await currentPhotoSrc()).toMatch(/\/fallback\.webp$/)
  })

  it('shows the credit whenever the photo carries a location', async () => {
    await manifestCache.setValue({
      data: makeManifest([makePhoto('a', { location: 'Tofino, BC' })]),
      etag: null,
      fetchedAt: Date.now(),
    })
    render(<App />)

    expect(await screen.findByText('Tofino, BC')).toBeTruthy()
  })

  it('hides the clock when it is switched off', async () => {
    await seedPhotos()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, enabled: false },
    })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('.background')).not.toBeNull())
    expect(container.querySelector('time')).toBeNull()
  })

  it('shows the weather for the chosen place, once switched on', async () => {
    await seedPhotos()
    const place = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place, unit: 'celsius' },
    })
    await weatherSource.cache.set(cacheKey(place, 'celsius'), {
      data: {
        code: 3,
        feelsLike: 11.9,
        high: 16.1,
        isDay: false,
        low: 9.3,
        sunrise: '2026-10-01T07:13',
        sunset: '2026-10-01T18:51',
        temperature: 12.3,
      },
      fetchedAt: Date.now(),
    })
    render(<App />)

    const weather = await screen.findByRole('region', { name: 'Weather' })
    expect(weather.textContent).toContain('12°')
    // The high and low are the only line under it until others are asked for.
    expect(weather.textContent).toContain('16°')
    expect(weather.textContent).not.toContain('Victoria')
  })

  it('has no weather until it is switched on', async () => {
    await seedPhotos()
    render(<App />)

    await currentPhotoSrc()
    expect(screen.queryByRole('region', { name: 'Weather' })).toBeNull()
  })

  it('opens the photo details panel', async () => {
    await manifestCache.setValue({
      data: makeManifest([makePhoto('a', { exif: { camera: 'Canon, EOS R5' } })]),
      etag: null,
      fetchedAt: Date.now(),
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Photo details' }))
    const panel = await screen.findByRole('dialog', { name: 'Photo details' })
    expect(panel.textContent).toContain('Canon, EOS R5')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Photo details' })).toBeNull())
  })

  it('pins a photo picked from the gallery in settings', async () => {
    await seedPhotos()
    await photoState.setValue({ bag: ['b'], currentId: 'a', shownAt: Date.now() })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, frequency: '1h' },
    })
    render(<App />)
    expect(await currentPhotoSrc()).toContain('/photos/a/')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const settings = await screen.findByRole('dialog', { name: 'Settings' })
    fireEvent.click(await within(settings).findByRole('button', { name: 'Photo b' }))

    await waitFor(async () => expect(await currentPhotoSrc()).toContain('/photos/b/'))
    await waitFor(async () =>
      expect((await settingsItem.getValue()).photos).toEqual({
        frequency: '1h',
        mode: 'pinned',
        pinnedId: 'b',
        tags: [],
      }),
    )
    expect((await photoState.getValue())?.currentId).toBe('b')
  })

  it('pins the next photo when → is pressed while pinned', async () => {
    await seedPhotos()
    await photoState.setValue({ bag: ['b'], currentId: 'a', shownAt: Date.now() })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, mode: 'pinned', pinnedId: 'a' },
    })
    render(<App />)
    expect(await currentPhotoSrc()).toContain('/photos/a/')

    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    await waitFor(async () => expect((await settingsItem.getValue()).photos.pinnedId).toBe('b'))
    expect(await currentPhotoSrc()).toContain('/photos/b/')
  })

  it('opens one popover at a time', async () => {
    await seedPhotos()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Photo details' }))
    expect(await screen.findByRole('dialog', { name: 'Photo details' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Photo details' })).toBeNull()

    // The gear closes what it opened.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes a popover with a click outside, but not with its own button', async () => {
    await seedPhotos()
    render(<App />)
    // The details button waits for a photo.
    await currentPhotoSrc()
    /** A real press: pointerdown, then click. */
    const press = (element: Element) => {
      fireEvent.pointerDown(element)
      fireEvent.click(element)
    }

    press(await screen.findByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    // The other popover's button switches straight to it.
    press(screen.getByRole('button', { name: 'Photo details' }))
    expect(await screen.findByRole('dialog', { name: 'Photo details' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

    // Its own button closes it, rather than closing and reopening it.
    press(screen.getByRole('button', { name: 'Photo details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    press(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    press(document.querySelector('.background') as Element)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('has no gallery button', async () => {
    await seedPhotos()
    render(<App />)

    await currentPhotoSrc()
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull()
  })

  it('opening a new tab keeps the photo when the frequency is not every-new-tab', async () => {
    await seedPhotos()
    await photoState.setValue({ bag: ['b'], currentId: 'a', shownAt: Date.now() })
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      photos: { ...DEFAULT_SETTINGS.photos, frequency: 'daily' },
    })

    render(<App />)

    expect(await currentPhotoSrc()).toContain('/photos/a/')
    // Nothing written, so other open tabs see no change either.
    expect((await photoState.getValue())?.currentId).toBe('a')
  })

  it('applies the chosen font and keeps it', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(await screen.findByRole('tab', { name: 'General' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Font' }))
    fireEvent.click(screen.getByRole('option', { name: 'Geist' }))

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--font-display')).toContain(
        'Geist Sans',
      ),
    )
    // The save looks at what is stored before it writes (see storage/guard), so it lands a beat
    // after the font is applied.
    await waitFor(async () => expect((await settingsItem.getValue()).font).toBe('geist'))
  })

  it('closes the settings panel with Escape', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  describe('onboarding', () => {
    it('shows nothing until the install has been recorded', async () => {
      const { container } = render(<App />)

      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByRole('note')).toBeNull()
    })

    it('welcomes a new install, and remembers a skip', async () => {
      await onboardingItem.setValue({ dismissed: ['weather'], welcomed: false })
      render(<App />)

      expect(await screen.findByRole('dialog', { name: 'Welcome to Lander' })).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.queryByRole('note')).toBeNull()
      expect(await onboardingItem.getValue()).toEqual({ dismissed: ['weather'], welcomed: true })
    })

    it('opens the settings on the tour from the welcome', async () => {
      await onboardingItem.setValue({ dismissed: ['weather'], welcomed: false })
      render(<App />)

      fireEvent.click(await screen.findByRole('button', { name: 'Show me around' }))

      const settings = await screen.findByRole('dialog', { name: 'Settings' })
      expect(screen.queryByRole('dialog', { name: 'Welcome to Lander' })).toBeNull()
      expect(within(settings).getByRole('note').textContent).toContain('1 of 4')
      expect((await onboardingItem.getValue())?.welcomed).toBe(true)

      // Opened again from the gear, it is just the settings.
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(within(await screen.findByRole('dialog')).queryByRole('note')).toBeNull()
    })

    it('tells an updated install about the weather, and opens its settings', async () => {
      await onboardingItem.setValue({ dismissed: [], welcomed: true })
      render(<App />)

      const note = await screen.findByRole('note')
      expect(note.textContent).toContain('New: weather')
      expect(screen.queryByRole('dialog')).toBeNull()

      fireEvent.click(within(note).getByRole('button', { name: 'Set up' }))

      await screen.findByRole('dialog', { name: 'Settings' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Weather')
      expect(screen.queryByRole('note')).toBeNull()
      expect((await onboardingItem.getValue())?.dismissed).toEqual(['weather'])
    })

    it('keeps the news dismissed', async () => {
      await onboardingItem.setValue({ dismissed: [], welcomed: true })
      const { unmount } = render(<App />)

      fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect((await onboardingItem.getValue())?.dismissed).toEqual(['weather'])

      unmount()
      const { container } = render(<App />)
      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      expect(screen.queryByRole('note')).toBeNull()
    })

    it('has no news of the weather for someone already using it', async () => {
      await onboardingItem.setValue({ dismissed: [], welcomed: true })
      await settingsItem.setValue({
        ...DEFAULT_SETTINGS,
        weather: { ...DEFAULT_SETTINGS.weather, enabled: true },
      })
      const { container } = render(<App />)

      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      // Long enough for the availability check to have answered.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.queryByRole('note')).toBeNull()
    })

    it('has no news of the weather while the manifest has it switched off', async () => {
      await onboardingItem.setValue({ dismissed: [], welcomed: true })
      await manifestCache.setValue({
        data: { ...makeManifest([makePhoto('a')]), weather: { enabled: false } },
        etag: null,
        fetchedAt: Date.now(),
      })
      const { container } = render(<App />)

      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.queryByRole('note')).toBeNull()
    })
  })
})

describe('App, when a change cannot be saved', () => {
  const SAVE_FAILED = "Couldn't save that. Try again in a minute."

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  /** What the page's live region says: empty when there is no notice. */
  const said = () => screen.getByRole('status').textContent

  /** Opens the settings and flicks Dim the photo, which starts on. */
  const flickDim = async () => {
    if (!screen.queryByRole('dialog', { name: 'Settings' })) {
      fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    }
    fireEvent.click(await screen.findByLabelText('Dim the photo'))
  }

  const rejectSettings = () =>
    vi.spyOn(settingsItem, 'setValue').mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM'))

  it('says so and puts the switch back when the browser rejects the save', async () => {
    await seedPhotos()
    rejectSettings()
    render(<App />)

    await flickDim()

    await waitFor(() => expect(said()).toContain(SAVE_FAILED))
    await waitFor(() =>
      expect((screen.getByLabelText('Dim the photo') as HTMLInputElement).checked).toBe(true),
    )
    expect((await settingsItem.getValue()).dim).toBe(true)
  })

  it('has its live region from the start, empty, so the line is announced when it comes', async () => {
    await seedPhotos()
    rejectSettings()
    render(<App />)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')

    await flickDim()

    await waitFor(() => expect(said()).toContain(SAVE_FAILED))
    expect(screen.getByRole('status')).toBe(region)
  })

  it('has no line while saves go through', async () => {
    await seedPhotos()
    render(<App />)

    await flickDim()

    await waitFor(async () => expect((await settingsItem.getValue()).dim).toBe(false))
    expect(said()).toBe('')
  })

  it('goes when it is dismissed', async () => {
    await seedPhotos()
    rejectSettings()
    render(<App />)
    await flickDim()
    await waitFor(() => expect(said()).toContain(SAVE_FAILED))

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(said()).toBe('')
  })

  it('goes after 8 seconds', async () => {
    await seedPhotos()
    rejectSettings()
    // Before the failure, so the timer the page sets is the faked one. Time still moves on its own.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<App />)
    await flickDim()
    await waitFor(() => expect(said()).toContain(SAVE_FAILED))

    await act(async () => {
      vi.advanceTimersByTime(7_500)
    })
    expect(said()).toContain(SAVE_FAILED)
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(said()).toBe('')
  })

  it('starts the 8 seconds again with a second failure', async () => {
    await seedPhotos()
    const setValue = rejectSettings()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<App />)
    await flickDim()
    await waitFor(() => expect(said()).toContain(SAVE_FAILED))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    await flickDim()
    await waitFor(() => expect(setValue).toHaveBeenCalledTimes(2))
    // Let the second rejection reach the page.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    // Ten seconds after the first failure, five after the second.
    expect(said()).toContain(SAVE_FAILED)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000)
    })
    expect(said()).toBe('')
  })

  it('clears its 8 seconds when the page goes', async () => {
    await seedPhotos()
    rejectSettings()
    const started = vi.spyOn(globalThis, 'setTimeout')
    const cleared = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<App />)
    await flickDim()
    await waitFor(() => expect(said()).toContain(SAVE_FAILED))
    // Effects run after paint, so the timer follows the line by a moment.
    await waitFor(() => expect(started.mock.calls.some(([, delay]) => delay === 8_000)).toBe(true))
    const timer =
      started.mock.results[started.mock.calls.findIndex(([, delay]) => delay === 8_000)]?.value

    unmount()

    expect(cleared).toHaveBeenCalledWith(timer)
  })

  it('goes with the next save that succeeds', async () => {
    await seedPhotos()
    const setValue = vi.spyOn(settingsItem, 'setValue').mockRejectedValueOnce(new Error('quota'))
    render(<App />)
    await flickDim()
    await waitFor(() => expect(said()).toContain(SAVE_FAILED))

    fireEvent.click(screen.getByLabelText('Dim the photo'))

    await waitFor(() => expect(said()).toBe(''))
    expect(setValue).toHaveBeenCalledTimes(2)
  })

  it('says so when the onboarding record cannot be saved either', async () => {
    await onboardingItem.setValue({ dismissed: [], welcomed: false })
    vi.spyOn(onboardingItem, 'setValue').mockRejectedValue(new Error('quota'))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))

    await waitFor(() => expect(said()).toContain(SAVE_FAILED))
  })
})

describe('App, when the settings are from a newer version', () => {
  const UPDATE_TO_CHANGE = 'Update Lander to change this.'

  /** What a newer version wrote: settings this one reads, with a block of its own beside them. */
  const NEWER = {
    ...DEFAULT_SETTINGS,
    bookmarks: { open: 'tab' },
    dim: false,
    font: 'geist',
    photos: { ...DEFAULT_SETTINGS.photos, mode: 'pinned', pinnedId: 'a' },
    v: 2,
  }

  const storedSettings = async () => (await fakeBrowser.storage.sync.get('settings')).settings

  afterEach(() => vi.restoreAllMocks())

  const openSettings = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    return screen.findByRole('dialog', { name: 'Settings' })
  }

  it('draws the page from them, and says in the settings to update', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ settings: NEWER })
    const { container } = render(<App />)

    await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
    expect(await currentPhotoSrc()).toContain('/photos/a/')
    const settings = await openSettings()

    expect(within(settings).getByText(UPDATE_TO_CHANGE)).toBeTruthy()
    expect(settings.querySelector('fieldset[disabled]')).not.toBeNull()
    expect(document.documentElement.style.getPropertyValue('--font-display')).toContain(
      'Geist Sans',
    )
  })

  it('never writes to storage: not from a settings change, a font change or the next photo', async () => {
    await seedPhotos()
    await photoState.setValue({ bag: ['b'], currentId: 'a', shownAt: Date.now() })
    await fakeBrowser.storage.sync.set({ settings: NEWER })
    const setValue = vi.spyOn(settingsItem, 'setValue')
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    render(<App />)
    await currentPhotoSrc()
    const settings = await openSettings()

    // The controls are off in a browser; a change that got through anyway must still not save.
    fireEvent.click(within(settings).getByLabelText('Dim the photo'))
    fireEvent.click(within(settings).getByRole('tab', { name: 'General' }))
    fireEvent.click(await within(settings).findByRole('combobox', { name: 'Font' }))
    fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    await waitFor(async () => expect(await currentPhotoSrc()).toContain('/photos/b/'))
    await act(async () => {})
    expect(setValue).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(await storedSettings()).toEqual(NEWER)
    // And it is no failure to save.
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('goes read-only when a newer version syncs in while the page is open', async () => {
    await seedPhotos()
    await settingsItem.setValue({ ...DEFAULT_SETTINGS })
    render(<App />)
    const settings = await openSettings()
    expect(within(settings).queryByText(UPDATE_TO_CHANGE)).toBeNull()

    await act(async () => {
      await fakeBrowser.storage.sync.set({ settings: NEWER })
    })

    expect(await within(settings).findByText(UPDATE_TO_CHANGE)).toBeTruthy()
  })

  it('is as before for settings of the version it knows, and saves them with `v: 1`', async () => {
    await seedPhotos()
    const v023 = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).filter(([key]) => key !== 'v'))
    await fakeBrowser.storage.sync.set({ settings: v023 })
    render(<App />)
    const settings = await openSettings()
    expect(within(settings).queryByText(UPDATE_TO_CHANGE)).toBeNull()
    // Nothing is written by loading.
    expect(await storedSettings()).toEqual(v023)

    fireEvent.click(await within(settings).findByLabelText('Dim the photo'))

    await waitFor(async () => expect(await storedSettings()).toEqual({ ...v023, dim: false, v: 1 }))
  })
})
