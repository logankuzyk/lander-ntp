import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { layoutItem } from '@/layout/storage'
import { onboardingItem } from '@/onboarding/storage'
import { manifestCache, photoState } from '@/photos/storage'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { makeManifest, makePhoto, makeWeather } from '@/test/fixtures'
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

    it('starts the tour on the page from the welcome, at the Edit button', async () => {
      await onboardingItem.setValue({ dismissed: ['weather'], welcomed: false })
      // The test DOM has no layout: everything is drawn at one place, enough to be found.
      const drawn = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(() => new DOMRect(1100, 834, 40, 40))
      render(<App />)

      fireEvent.click(await screen.findByRole('button', { name: 'Show me around' }))

      const note = await screen.findByRole('note')
      drawn.mockRestore()
      expect(screen.queryByRole('dialog', { name: 'Welcome to Lander' })).toBeNull()
      expect(note.textContent).toContain('Edit your page')
      expect(note.textContent).toContain('1 of 7')
      // The settings come at the end of the tour, and the tour is not offered again from the gear.
      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
      expect((await onboardingItem.getValue())?.welcomed).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(within(await screen.findByRole('dialog')).queryByRole('note')).toBeNull()
    })

    it('has no news for an updated install now: the weather one, which opened a tab that is gone, is removed', async () => {
      await onboardingItem.setValue({ dismissed: [], welcomed: true })
      const { container } = render(<App />)

      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      // Long enough for the availability check to have answered.
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.queryByRole('note')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
      // Nothing written: no dismissal is made for it either.
      expect(await onboardingItem.getValue()).toEqual({ dismissed: [], welcomed: true })
    })

    it('leaves the weather id in a stored record alone', async () => {
      await onboardingItem.setValue({ dismissed: ['weather'], welcomed: true })
      const { container } = render(<App />)

      await waitFor(() => expect(container.querySelector('time')).not.toBeNull())
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.queryByRole('note')).toBeNull()
      expect(await onboardingItem.getValue()).toEqual({ dismissed: ['weather'], welcomed: true })
    })
  })
})

describe('App, on the Grid', () => {
  const PLACE = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }

  /** Each box on the page as [type, column, row]: where CSS grid is told to put it. */
  const boxes = (container: ParentNode) =>
    [...container.querySelectorAll<HTMLElement>('.widget-box')].map((box) => [
      box.dataset.widget,
      box.style.gridColumn,
      box.style.gridRow,
    ])

  const settingsWith = (settings: {
    clock?: Partial<typeof DEFAULT_SETTINGS.clock>
    weather?: Partial<typeof DEFAULT_SETTINGS.weather>
  }) => ({
    ...DEFAULT_SETTINGS,
    clock: { ...DEFAULT_SETTINGS.clock, ...settings.clock },
    weather: { ...DEFAULT_SETTINGS.weather, ...settings.weather },
  })

  /** A reading cached for the place, so a Weather on the page asks nothing of the forecast. */
  const cacheReading = () =>
    weatherSource.cache.set(cacheKey(PLACE, 'celsius'), {
      data: makeWeather(),
      fetchedAt: Date.now(),
    })

  /** Waits until the page has drawn the Grid, which it does once settings and Layout are known. */
  const drawn = async (container: ParentNode) => {
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
  }

  it('draws one Clock box at column 5, row 4, 4 by 2, on a new install', async () => {
    await seedPhotos()
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([['clock', '5 / span 4', '4 / span 2']])
  })

  it('draws no Grid before the stored settings and Layout are known', async () => {
    await seedPhotos()
    // A Weather stored in the settings: drawn from the defaults first, it would not be there.
    await settingsItem.setValue(
      settingsWith({ weather: { enabled: true, place: PLACE, unit: 'celsius' } }),
    )
    await cacheReading()
    const { container } = render(<App />)

    expect(container.querySelector('.grid')).toBeNull()
    expect(container.querySelector('.widget-box')).toBeNull()

    await drawn(container)
    expect(boxes(container).map(([type]) => type)).toEqual(['weather', 'clock'])
  })

  /** Holds a stored item's read until `release` is called, then lets it answer as it would. */
  const holdRead = <T,>(item: { read: () => Promise<T> }) => {
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    const read = item.read.bind(item)
    vi.spyOn(item, 'read').mockImplementation(async () => {
      await held
      return read()
    })
    return release
  }

  /** Long enough for everything that is not held to have arrived and been drawn. */
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 30)))

  it('draws no Grid while the stored Layout is still being read, however soon the settings arrive', async () => {
    await seedPhotos()
    const release = holdRead(layoutItem)
    const { container } = render(<App />)

    await settle()
    // The settings are in (the photo credit and controls are not held back), the Layout is not.
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
    expect(container.querySelector('.grid')).toBeNull()

    release()
    await drawn(container)
    vi.restoreAllMocks()
  })

  it('draws no Grid while the stored settings are still being read, however soon the Layout arrives', async () => {
    await seedPhotos()
    const release = holdRead(settingsItem)
    const { container } = render(<App />)

    await settle()
    expect(container.querySelector('.grid')).toBeNull()

    release()
    await drawn(container)
    vi.restoreAllMocks()
  })

  it('draws the Weather of an updated user at column 11, row 1, and the Clock where it was', async () => {
    await seedPhotos()
    await settingsItem.setValue(
      settingsWith({ weather: { enabled: true, place: PLACE, unit: 'celsius' } }),
    )
    await cacheReading()
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([
      ['weather', '11 / span 2', '1 / span 2'],
      ['clock', '5 / span 4', '4 / span 2'],
    ])
  })

  it('draws the Clock with seconds 6 wide, from column 4', async () => {
    await seedPhotos()
    await settingsItem.setValue(settingsWith({ clock: { showSeconds: true } }))
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([['clock', '4 / span 6', '4 / span 2']])
  })

  it('draws an empty Grid when the Clock and the Weather are both off', async () => {
    await seedPhotos()
    await settingsItem.setValue(settingsWith({ clock: { enabled: false } }))
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([])
  })

  it('draws the stored Layout, not the settings, once there is one', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({
      layout: {
        v: 1,
        widgets: [{ col: 1, h: 2, id: 'aaaaaaaa', options: {}, row: 7, type: 'clock', w: 4 }],
      },
    })
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([['clock', '1 / span 4', '7 / span 2']])
  })

  it('draws a stored Widget that sits on another in the free place nearest the middle', async () => {
    await seedPhotos()
    const clock = (id: string) => ({
      col: 5,
      h: 2,
      id,
      options: {},
      row: 4,
      type: 'clock',
      w: 4,
    })
    await fakeBrowser.storage.sync.set({
      layout: { v: 1, widgets: [clock('aaaaaaaa'), clock('bbbbbbbb')] },
    })
    const { container } = render(<App />)

    await drawn(container)
    expect(boxes(container)).toEqual([
      ['clock', '5 / span 4', '2 / span 2'],
      ['clock', '5 / span 4', '4 / span 2'],
    ])
  })

  it('writes nothing to sync storage: not on load, and not on a resize', async () => {
    await seedPhotos()
    await settingsItem.setValue(settingsWith({ weather: { enabled: true, place: PLACE } }))
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const { container } = render(<App />)

    await drawn(container)
    globalThis.dispatchEvent(new Event('resize'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(set).not.toHaveBeenCalled()
    expect(await fakeBrowser.storage.sync.get('layout')).toEqual({})
  })
})

describe('App, in edit mode', () => {
  const doneButton = () => screen.getByRole('button', { name: 'Done' })
  const editButton = () => screen.getByRole('button', { name: 'Edit' })

  /** The page, drawn and with its photo, so everything that loads has loaded. */
  const drawnPage = async () => {
    await seedPhotos()
    const view = render(<App />)
    await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
    await currentPhotoSrc()
    return view
  }

  it('starts every page out of it, with the Edit button not pressed and no dots', async () => {
    const { container } = await drawnPage()

    expect(editButton().getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('.grid--editing')).toBeNull()
    expect(container.querySelector('.grid__dots')).toBeNull()
  })

  it('is entered with the Edit button and left with Done, which shows the dots over the Grid', async () => {
    const { container } = await drawnPage()

    fireEvent.click(editButton())
    expect(doneButton().getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.grid--editing .grid__dots')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Clock' }).getAttribute('tabindex')).toBe('0')

    fireEvent.click(doneButton())
    expect(editButton().getAttribute('aria-pressed')).toBe('false')
    expect(container.querySelector('.grid__dots')).toBeNull()
    // The box keeps its name (W20) but is no longer a tab stop.
    expect(screen.getByRole('group', { name: 'Clock' }).getAttribute('tabindex')).toBeNull()
  })

  it('is toggled with the E key and left with Escape', async () => {
    await drawnPage()

    fireEvent.keyDown(document.body, { key: 'e' })
    expect(doneButton()).toBeTruthy()
    fireEvent.keyDown(document.body, { key: 'e' })
    expect(editButton()).toBeTruthy()

    fireEvent.keyDown(document.body, { key: 'e' })
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(editButton()).toBeTruthy()
  })

  it('closes the settings panel on the first Escape and leaves on the second', async () => {
    await drawnPage()
    fireEvent.keyDown(document.body, { key: 'e' })
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(doneButton()).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(editButton()).toBeTruthy()
  })

  it('closes the photo details on the first Escape and leaves on the second', async () => {
    await drawnPage()
    fireEvent.click(editButton())
    fireEvent.click(screen.getByRole('button', { name: 'Photo details' }))
    expect(await screen.findByRole('dialog', { name: /photo/i })).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(doneButton()).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(editButton()).toBeTruthy()
  })

  it('ignores E pressed inside the settings panel, where it is typed into the place search', async () => {
    await drawnPage()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const settings = await screen.findByRole('dialog', { name: 'Settings' })

    fireEvent.keyDown(within(settings).getByRole('tab', { name: 'Photos' }), { key: 'e' })

    expect(editButton()).toBeTruthy()
  })

  it('keeps the next photo, details and settings buttons and the → key working', async () => {
    await seedPhotos()
    render(<App />)
    const first = await currentPhotoSrc()
    fireEvent.click(editButton())

    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    await waitFor(async () => expect(await currentPhotoSrc()).not.toBe(first))
    expect(doneButton()).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(doneButton()).toBeTruthy()
  })

  it('writes nothing: not entering, tabbing, leaving, or being left', async () => {
    await drawnPage()
    const before = {
      layout: await fakeBrowser.storage.sync.get('layout'),
      local: await fakeBrowser.storage.local.get(),
      onboarding: await fakeBrowser.storage.sync.get('onboarding'),
      settings: await fakeBrowser.storage.sync.get('settings'),
    }
    const syncSet = vi.spyOn(fakeBrowser.storage.sync, 'set')
    const localSet = vi.spyOn(fakeBrowser.storage.local, 'set')

    fireEvent.click(editButton())
    screen.getByRole('group', { name: 'Clock' }).focus()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.keyDown(document.body, { key: 'e' })
    fireEvent.click(doneButton())
    await act(async () => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(syncSet).not.toHaveBeenCalled()
    expect(localSet).not.toHaveBeenCalled()
    expect({
      layout: await fakeBrowser.storage.sync.get('layout'),
      local: await fakeBrowser.storage.local.get(),
      onboarding: await fakeBrowser.storage.sync.get('onboarding'),
      settings: await fakeBrowser.storage.sync.get('settings'),
    }).toEqual(before)
  })

  it('is not remembered: the next page starts out of it', async () => {
    const first = await drawnPage()
    fireEvent.click(editButton())
    first.unmount()

    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())

    expect(editButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('can be entered while the Layout is from a newer version, which it does not save over', async () => {
    await seedPhotos()
    await fakeBrowser.storage.sync.set({ layout: { v: 2, widgets: [] } })
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())

    fireEvent.click(editButton())

    expect(doneButton().getAttribute('aria-pressed')).toBe('true')
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

describe('App, when the Layout is from a newer version', () => {
  const UPDATE_TO_CHANGE = 'Update Lander to change this.'
  const NEWER_LAYOUT = {
    v: 2,
    widgets: [
      {
        col: 5,
        h: 2,
        id: 'clock0001',
        options: { showDate: true, showSeconds: false },
        row: 4,
        type: 'clock',
        w: 4,
      },
      {
        col: 1,
        future: { colour: 'blue' },
        h: 2,
        id: 'future01',
        options: { future: true },
        row: 1,
        type: 'calendar',
        w: 2,
      },
    ],
  }

  afterEach(() => vi.restoreAllMocks())

  it('draws what it knows and explains that layout changes need an update', async () => {
    await seedPhotos()
    await settingsItem.setValue({
      ...DEFAULT_SETTINGS,
      clock: { ...DEFAULT_SETTINGS.clock, hour12: false },
    })
    await fakeBrowser.storage.sync.set({ layout: NEWER_LAYOUT })
    const saveLayout = vi.spyOn(layoutItem, 'setValue')
    const saveSettings = vi.spyOn(settingsItem, 'setValue')
    const { container } = render(<App />)

    expect(await screen.findByRole('group', { name: 'Unknown widget, calendar' })).toBeTruthy()
    expect(screen.getByText('Needs a newer version of Lander')).toBeTruthy()
    expect(container.querySelector('time')).not.toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const done = screen.getByRole('button', { name: 'Done' })
    expect(done.parentElement?.textContent).toContain(UPDATE_TO_CHANGE)
    expect(container.querySelector('.grid--movable')).toBeNull()
    expect(container.querySelector('.widget-box__resize')).toBeNull()
    expect(container.querySelector('.widget-box__remove')).toBeNull()

    fireEvent.click(await screen.findByRole('button', { name: 'Add' }))
    const menu = screen.getByRole('menu', { name: 'Add a widget' })
    expect(menu.parentElement?.textContent).toContain(UPDATE_TO_CHANGE)
    for (const name of ['Clock', 'Weather']) {
      expect(within(menu).getByRole('menuitem', { name }).getAttribute('aria-disabled')).toBe(
        'true',
      )
    }
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Clock' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.click(screen.getByRole('button', { name: 'Clock options' }))
    const popover = await screen.findByRole('dialog', { name: 'Clock options' })
    expect(within(popover).getByText(UPDATE_TO_CHANGE)).toBeTruthy()
    expect(within(popover).getByRole('switch', { name: 'Show date' }).matches(':disabled')).toBe(
      true,
    )
    const twentyFourHour = within(popover).getByRole('switch', { name: '24-hour time' })
    expect(twentyFourHour.matches(':disabled')).toBe(false)
    fireEvent.click(twentyFourHour)

    await waitFor(async () => expect((await settingsItem.getValue()).clock.hour12).toBe(true))
    expect(saveLayout).not.toHaveBeenCalled()
    expect(saveSettings).toHaveBeenCalledOnce()
    expect(await fakeBrowser.storage.sync.get('layout')).toEqual({ layout: NEWER_LAYOUT })
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
