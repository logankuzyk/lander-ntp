import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CalloutInfo } from '@/onboarding/callouts'
import type { PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makePhoto } from '@/test/fixtures'
import { devicePosition } from '@/weather/deviceLocation'

import { SettingsPanel } from './SettingsPanel'
import { WeatherFields } from './WeatherFields'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
  photos: { frequency: '1h', mode: 'cycle', pinnedId: null, tags: [] },
  weather: { ...DEFAULT_SETTINGS.weather, unit: 'celsius' },
}

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [{ name: 'Water', slug: 'water' }] }),
  makePhoto('b', { alt: 'Tide pools', tags: [{ name: 'Beach', slug: 'beach' }] }),
]

const renderPanel = ({
  overrides = {},
  photos = PHOTOS,
}: { overrides?: Partial<Settings>; photos?: Photo[] } = {}) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  render(
    <SettingsPanel
      currentId="a"
      onChange={onChange}
      onClose={onClose}
      photos={photos}
      settings={{ ...settings, ...overrides }}
    />,
  )
  return { onChange, onClose }
}

const withPhotos = (changes: Partial<PhotoSettings>): Settings => ({
  ...settings,
  photos: { ...settings.photos, ...changes },
})

const openSection = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

describe('SettingsPanel', () => {
  it('opens as a labelled popover with the close button focused', () => {
    renderPanel()

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
  })

  it('closes with the button, with Escape and with a click outside', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open for clicks inside it', () => {
    const { onClose } = renderPanel()

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'Clock' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tide pools' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  describe('sections', () => {
    it('lists photos, clock, weather and general settings, starting on photos', () => {
      renderPanel()

      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Photos', 'Clock', 'Weather', 'General'])
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
      expect(screen.getByRole('tabpanel', { name: 'Photos' })).toBeTruthy()
    })

    it('switches section from the sidebar', () => {
      renderPanel()

      openSection('Clock')

      expect(screen.getByRole('tabpanel', { name: 'Clock' })).toBeTruthy()
      expect(screen.getByLabelText('Show clock')).toBeTruthy()
      expect(screen.queryByLabelText('Change photo')).toBeNull()
    })

    it('moves between sections with the arrow keys', () => {
      renderPanel()
      const photos = screen.getByRole('tab', { name: 'Photos' })

      fireEvent.keyDown(photos, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Clock' }))
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Clock')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('General')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
    })

    it('has no favourites', () => {
      renderPanel()

      expect(screen.queryByRole('tab', { name: 'Favourites' })).toBeNull()
      expect(screen.queryByText(/favourite/i)).toBeNull()
    })
  })

  describe('photos', () => {
    /** Open a dropdown by its label and pick an option. */
    const choose = (field: string, option: string) => {
      fireEvent.click(screen.getByRole('combobox', { name: field }))
      fireEvent.click(screen.getByRole('option', { name: option }))
    }

    it('changes how often the photo changes', () => {
      const { onChange } = renderPanel()

      expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Every hour')
      choose('Change photo', 'Every day')

      expect(onChange).toHaveBeenCalledWith(withPhotos({ frequency: 'daily' }))
      // A choice closes the menu.
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('closes only the menu with Escape, not the settings', () => {
      const { onClose } = renderPanel()

      fireEvent.click(screen.getByRole('combobox', { name: 'Change photo' }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

      expect(screen.queryByRole('listbox')).toBeNull()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('keeps the photo on screen when set to never, remembering the frequency', () => {
      const { onChange } = renderPanel()

      choose('Change photo', 'Never')

      expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'a' }))
    })

    it('cycles tags chosen from the multi-select', () => {
      const { onChange } = renderPanel()
      const field = screen.getByRole('combobox', { name: 'Tags' })

      expect(field.textContent).toBe('All')
      fireEvent.click(field)
      const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
      expect(menu.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Beach',
        'Water',
      ])
      fireEvent.click(menu.getByRole('option', { name: 'Water' }))

      expect(onChange).toHaveBeenCalledWith(withPhotos({ tags: ['water'] }))
    })

    it('shows the cycled tags as chips, and removes or resets them from the menu', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water', 'beach'] }) })
      const field = screen.getByRole('combobox', { name: 'Tags' })

      expect(field.textContent).toBe('WaterBeach')
      fireEvent.click(field)
      const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
      // Only the tags not already chosen are offered.
      expect(menu.queryAllByRole('option')).toEqual([])

      fireEvent.click(menu.getByRole('button', { name: 'Remove Water' }))
      expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: ['beach'] }))

      fireEvent.click(menu.getByRole('button', { name: 'Reset to all' }))
      expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: [] }))
    })

    it('offers the tags only while cycling, and keeps them for when it resumes', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
      })

      expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Never')
      expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Resume cycling' }))

      expect(onChange).toHaveBeenCalledWith(
        withPhotos({ mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
      )
    })

    it('keeps the tags when cycling is set to a frequency again', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
      })

      choose('Change photo', 'Every day')

      expect(onChange).toHaveBeenCalledWith(
        withPhotos({ frequency: 'daily', mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
      )
    })

    it('filters the gallery to the tag being cycled, when there is one', () => {
      renderPanel({ overrides: withPhotos({ tags: ['beach'] }) })

      const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
      expect(filters.getByRole('button', { name: 'Beach' }).getAttribute('aria-pressed')).toBe(
        'true',
      )
    })

    it('pins a photo picked from the gallery', () => {
      const { onChange } = renderPanel()

      fireEvent.click(screen.getByRole('button', { name: 'Tide pools' }))

      expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'b' }))
    })

    it('reads tags no photo has as all photos, and clears them on the next change', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['mountains'] }) })

      expect(screen.getByRole('combobox', { name: 'Tags' }).textContent).toBe('All')
      const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
      expect(filters.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
    })

    it('clears tags the photos lack from other sections too, such as with the fallback photo', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ tags: ['water'] }),
        photos: [makePhoto('fallback')],
      })
      openSection('Clock')

      fireEvent.click(screen.getByLabelText('Show date'))

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        clock: { ...settings.clock, showDate: true },
      })
    })

    it('keeps the tags while the photos are loading', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water'] }), photos: [] })

      expect(screen.getByText('Loading photos…')).toBeTruthy()
      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...withPhotos({ tags: ['water'] }), dim: false })
    })

    it('has no gallery or tags with only one photo', () => {
      renderPanel({ photos: [makePhoto('fallback')] })

      expect(screen.queryByRole('heading', { name: 'Gallery' })).toBeNull()
      expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
    })

    it('switches the photo wash off', () => {
      const { onChange } = renderPanel()

      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
    })

    it('grows before it scrolls, holding the top in place', () => {
      renderPanel()
      const dialog = screen.getByRole('dialog', { name: 'Settings' })
      const body = screen.getByRole('tabpanel')
      // No layout here: a 1000px section showing 200px, in a popover capped at 800px.
      const grown = () => parseFloat(body.style.getPropertyValue('--popover-grow') || '0')
      dialog.style.maxHeight = '800px'
      Object.defineProperty(dialog, 'offsetHeight', { get: () => 300 + grown() })
      Object.defineProperty(body, 'clientHeight', { get: () => 200 + grown() })
      Object.defineProperty(body, 'scrollHeight', { value: 1000 })
      Object.defineProperty(body, 'scrollTop', { value: 0, writable: true })

      const first = new WheelEvent('wheel', { cancelable: true, deltaY: 450 })
      body.dispatchEvent(first)

      expect(first.defaultPrevented).toBe(true)
      expect(grown()).toBe(450)
      expect(body.scrollTop).toBe(0)

      // 50px short of the cap: the rest of the wheel scrolls.
      body.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: 100 }))
      expect(grown()).toBe(500)
      expect(body.scrollTop).toBe(50)

      // At the cap, and scrolling up, the browser scrolls as usual.
      const atCap = new WheelEvent('wheel', { cancelable: true, deltaY: 100 })
      body.dispatchEvent(atCap)
      const up = new WheelEvent('wheel', { cancelable: true, deltaY: -100 })
      body.dispatchEvent(up)
      expect(atCap.defaultPrevented).toBe(false)
      expect(up.defaultPrevented).toBe(false)
      expect(grown()).toBe(500)

      // Another section starts at rest again.
      openSection('Clock')
      expect(grown()).toBe(0)
      expect(body.scrollTop).toBe(0)
    })
  })

  describe('clock', () => {
    it('switches to 24-hour time', () => {
      const { onChange } = renderPanel()
      openSection('Clock')
      const toggle = screen.getByLabelText('24-hour time') as HTMLInputElement

      expect(toggle.checked).toBe(false)
      fireEvent.click(toggle)

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        clock: { ...settings.clock, hour12: false },
      })
    })

    it.each([
      ['Show clock', 'enabled', false],
      ['Show date', 'showDate', true],
      ['Show seconds', 'showSeconds', true],
    ])('toggles %s', (label, key, expected) => {
      const { onChange } = renderPanel()
      openSection('Clock')

      fireEvent.click(screen.getByLabelText(label))

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        clock: { ...settings.clock, [key]: expected },
      })
    })

    it('hides the clock options while the clock is off', () => {
      renderPanel({ overrides: { clock: { ...settings.clock, enabled: false } } })
      openSection('Clock')

      const panel = within(screen.getByRole('tabpanel'))
      expect(panel.getByLabelText('Show clock')).toBeTruthy()
      expect(panel.queryByLabelText('Show seconds')).toBeNull()
    })
  })

  describe('general', () => {
    it('changes the font', () => {
      const { onChange } = renderPanel()
      openSection('General')

      fireEvent.click(screen.getByRole('combobox', { name: 'Font' }))
      fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))

      expect(onChange).toHaveBeenCalledWith({ ...settings, font: 'instrument-serif' })
    })
  })

  describe('weather', () => {
    const PLACE = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }
    /** Two shown and three hidden, to move between. */
    const FIELDS: Settings['weather']['fields'] = [
      { id: 'location', shown: true },
      { id: 'sun', shown: true },
      { id: 'condition', shown: false },
      { id: 'feelsLike', shown: false },
      { id: 'highLow', shown: false },
    ]

    const withWeather = (changes: Partial<Settings['weather']>): Settings => ({
      ...settings,
      weather: { ...settings.weather, ...changes },
    })

    const renderWeather = (changes: Partial<Settings['weather']> = {}) => {
      const rendered = renderPanel({ overrides: withWeather(changes) })
      openSection('Weather')
      return rendered
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('offers only the switch while the widget is off', () => {
      const { onChange } = renderWeather()

      expect(screen.queryByRole('combobox', { name: 'Units' })).toBeNull()
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()

      fireEvent.click(screen.getByLabelText('Show weather'))
      return waitFor(() => expect(onChange).toHaveBeenCalledWith(withWeather({ enabled: true })))
    })

    it('searches for a place and keeps the one picked', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({
              results: [
                {
                  admin1: 'British Columbia',
                  country: 'Canada',
                  id: 1,
                  latitude: 48.4359,
                  longitude: -123.35155,
                  name: 'Victoria',
                },
              ],
            }),
          ok: true,
        }),
      )
      const { onChange } = renderWeather({ enabled: true })

      fireEvent.input(screen.getByRole('combobox', { name: 'Search for a place' }), {
        target: { value: 'Victoria' },
      })
      fireEvent.click(
        await screen.findByRole('option', { name: 'Victoria, British Columbia, Canada' }),
      )

      expect(onChange).toHaveBeenCalledWith(
        withWeather({ enabled: true, followDevice: false, place: PLACE }),
      )
    })

    describe('suggestions', () => {
      const found = (...names: string[]) =>
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({
                results: names.map((name, id) => ({
                  country: 'Canada',
                  id,
                  latitude: 48.4359,
                  longitude: -123.35155,
                  name,
                })),
              }),
            ok: true,
          }),
        )

      const searched = async () => {
        found('Victoria', 'Victoriaville')
        const rendered = renderWeather({ enabled: true })
        const box = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search for a place' })
        fireEvent.focus(box)
        fireEvent.input(box, { target: { value: 'Vic' } })
        await screen.findByRole('option', { name: 'Victoria, Canada' })
        return { ...rendered, box }
      }

      const active = () =>
        screen
          .queryAllByRole('option')
          .find((option) => option.getAttribute('aria-selected') === 'true')?.textContent

      it('puts each one in the box as the arrow keys reach it, and the typed text between', async () => {
        const { box } = await searched()

        fireEvent.keyDown(box, { key: 'ArrowDown' })
        expect(box.value).toBe('Victoria, Canada')
        expect(active()).toBe('Victoria, Canada')
        expect(box.getAttribute('aria-activedescendant')).toBe(
          screen.getByRole('option', { name: 'Victoria, Canada' }).id,
        )

        fireEvent.keyDown(box, { key: 'ArrowDown' })
        fireEvent.keyDown(box, { key: 'ArrowDown' })
        expect(box.value).toBe('Vic')
        expect(active()).toBeUndefined()

        fireEvent.keyDown(box, { key: 'ArrowUp' })
        expect(box.value).toBe('Victoriaville, Canada')
      })

      it('takes the one in the box with Enter', async () => {
        const { box, onChange } = await searched()

        fireEvent.keyDown(box, { key: 'ArrowDown' })
        fireEvent.keyDown(box, { key: 'Enter' })

        expect(onChange).toHaveBeenCalledWith(
          withWeather({ enabled: true, followDevice: false, place: PLACE }),
        )
      })

      it('searches once the typing pauses, for the text as it then is', async () => {
        found('Victoria')
        renderWeather({ enabled: true })
        const box = screen.getByRole('combobox', { name: 'Search for a place' })

        fireEvent.focus(box)
        for (const value of ['V', 'Vi', 'Vic']) fireEvent.input(box, { target: { value } })
        await screen.findByRole('option', { name: 'Victoria, Canada' })

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('name=Vic')
      })

      it('offers the current location only until there are places to show', async () => {
        const { box } = await searched()
        expect(screen.queryByRole('option', { name: 'Current location' })).toBeNull()

        fireEvent.input(box, { target: { value: '' } })
        expect(screen.getByRole('option', { name: 'Current location' })).toBeTruthy()
        expect(screen.queryByRole('option', { name: 'Victoria, Canada' })).toBeNull()
      })

      it('closes with Escape, leaving the typed text and the panel', async () => {
        const { box, onClose } = await searched()

        fireEvent.keyDown(box, { key: 'ArrowDown' })
        fireEvent.keyDown(box, { key: 'Escape' })

        expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()
        expect(box.value).toBe('Vic')
        expect(onClose).not.toHaveBeenCalled()
      })
    })

    it('says when nothing matches and when the search fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ json: () => Promise.resolve({}), ok: true }),
      )
      renderWeather({ enabled: true })
      const search = (value: string) =>
        fireEvent.input(screen.getByRole('combobox', { name: 'Search for a place' }), {
          target: { value },
        })

      search('qqq')
      expect(await screen.findByText('No places found.')).toBeTruthy()

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
      search('qqqq')
      expect(await screen.findByText('Couldn’t search just now.')).toBeTruthy()
    })

    it('shows the chosen place, and the search again to change it', () => {
      renderWeather({ enabled: true, place: PLACE })

      expect(screen.getByText('Victoria')).toBeTruthy()
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
    })

    describe('using the device location', () => {
      /** The suggestion under the search box, there once the box is focused. */
      const currentLocation = () => {
        fireEvent.focus(screen.getByRole('combobox', { name: 'Search for a place' }))
        fireEvent.click(screen.getByRole('option', { name: 'Current location' }))
      }

      it('suggests it only while the search box is focused', () => {
        renderWeather({ enabled: true })
        const box = screen.getByRole('combobox', { name: 'Search for a place' })
        expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()

        fireEvent.focus(box)
        expect(screen.getByRole('option', { name: 'Current location' })).toBeTruthy()
        expect(box.getAttribute('aria-expanded')).toBe('true')

        fireEvent.blur(box)
        expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()
      })

      const locating = (coords: { latitude: number; longitude: number } | null) =>
        vi.stubGlobal('navigator', {
          geolocation: {
            getCurrentPosition: (done: (position: unknown) => void, fail: () => void) =>
              coords ? done({ coords }) : fail(),
          },
          language: 'en-CA',
        })

      it('follows the device once the browser gives a position, keeping it off the settings', async () => {
        locating({ latitude: 48.4359, longitude: -123.35155 })
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue({ json: () => Promise.resolve({ city: 'Victoria' }), ok: true }),
        )
        const { onChange } = renderWeather({ enabled: true })

        currentLocation()

        await waitFor(() =>
          expect(onChange).toHaveBeenCalledWith(withWeather({ enabled: true, followDevice: true })),
        )
        expect(await devicePosition.getValue()).toEqual({
          latitude: 48.44,
          longitude: -123.35,
          name: 'Victoria',
        })
      })

      it('keeps a setting changed while the browser was asked, and asks only once', async () => {
        let found: (position: unknown) => void = () => {}
        const getCurrentPosition = vi.fn((done: typeof found) => {
          found = done
        })
        vi.stubGlobal('navigator', { geolocation: { getCurrentPosition }, language: 'en-CA' })
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue({ json: () => Promise.resolve({ city: 'Victoria' }), ok: true }),
        )
        const onChange = vi.fn()
        const panel = (weather: Partial<Settings['weather']>) => (
          <SettingsPanel
            currentId="a"
            onChange={onChange}
            onClose={vi.fn()}
            photos={PHOTOS}
            settings={withWeather(weather)}
          />
        )
        const { rerender } = render(panel({ enabled: true }))
        openSection('Weather')

        currentLocation()
        currentLocation()
        rerender(panel({ enabled: true, unit: 'fahrenheit' }))
        found({ coords: { latitude: 48.4359, longitude: -123.35155 } })

        await waitFor(() =>
          expect(onChange).toHaveBeenCalledWith(
            withWeather({ enabled: true, followDevice: true, unit: 'fahrenheit' }),
          ),
        )
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
      })

      it('says so when the position is refused', async () => {
        locating(null)
        const { onChange } = renderWeather({ enabled: true })

        currentLocation()

        expect(await screen.findByText(/Couldn’t get your location/)).toBeTruthy()
        expect(onChange).not.toHaveBeenCalled()
      })

      it('shows that it follows the device, and stops when a place is searched for', () => {
        renderWeather({ enabled: true, followDevice: true, place: PLACE })

        expect(screen.getByText('Current location')).toBeTruthy()
        expect(screen.queryByText('Victoria')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Change' }))
        expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
      })
    })

    it('changes the unit', () => {
      const { onChange } = renderWeather({ enabled: true, place: PLACE })
      const on = { enabled: true, place: PLACE }

      fireEvent.click(screen.getByRole('combobox', { name: 'Units' }))
      fireEvent.click(screen.getByRole('option', { name: 'Fahrenheit' }))
      expect(onChange).toHaveBeenCalledWith(withWeather({ ...on, unit: 'fahrenheit' }))
    })

    describe('fields', () => {
      const on = { enabled: true, fields: FIELDS, place: PLACE }
      const ids = (fields: Settings['weather']['fields']) => fields.map(({ id }) => id)
      const rows = () =>
        within(screen.getByRole('list', { name: 'Show' }))
          .getAllByRole('listitem')
          .map((row) => row.textContent)
      const lastFields = (onChange: ReturnType<typeof vi.fn>) =>
        (onChange.mock.lastCall?.[0] as Settings).weather.fields

      it('lists every field in order, with an eye that is open for the ones shown', () => {
        renderWeather(on)

        expect(rows()).toEqual([
          'Location',
          'Sunrise and sunset',
          'Conditions',
          'Feels like',
          'High and low',
        ])
        const pressed = (name: string) =>
          screen.getByRole('button', { name }).getAttribute('aria-pressed')
        expect(pressed('Show Location')).toBe('true')
        expect(pressed('Show High and low')).toBe('false')
        expect(
          screen.getByRole('button', { name: 'Show High and low' }).closest('li')?.className,
        ).toContain('fields__row--hidden')
      })

      it('moves a field switched on to the end of the shown ones', () => {
        const { onChange } = renderWeather(on)

        fireEvent.click(screen.getByRole('button', { name: 'Show High and low' }))

        expect(lastFields(onChange)).toEqual([
          { id: 'location', shown: true },
          { id: 'sun', shown: true },
          { id: 'highLow', shown: true },
          { id: 'condition', shown: false },
          { id: 'feelsLike', shown: false },
        ])
      })

      it('moves a field switched off to just after the last shown one', () => {
        const { onChange } = renderWeather(on)

        fireEvent.click(screen.getByRole('button', { name: 'Show Location' }))

        expect(lastFields(onChange)).toEqual([
          { id: 'sun', shown: true },
          { id: 'location', shown: false },
          { id: 'condition', shown: false },
          { id: 'feelsLike', shown: false },
          { id: 'highLow', shown: false },
        ])
      })

      it('reorders by dragging a row onto another, writing only on the drop', () => {
        const { onChange } = renderWeather(on)
        const row = (name: string) =>
          screen.getByRole('button', { name: `Reorder ${name}` }).closest('li') as HTMLElement

        fireEvent.dragStart(row('High and low'))
        fireEvent.dragOver(row('Location'))
        expect(rows()[0]).toBe('High and low')
        expect(onChange).not.toHaveBeenCalled()

        fireEvent.dragEnd(row('High and low'))
        expect(ids(lastFields(onChange))).toEqual([
          'highLow',
          'location',
          'sun',
          'condition',
          'feelsLike',
        ])
      })

      it('writes nothing when a row is dropped where it started', () => {
        const { onChange } = renderWeather(on)
        const row = screen.getByRole('button', { name: 'Reorder Location' }).closest('li')

        fireEvent.dragStart(row as HTMLElement)
        fireEvent.dragEnd(row as HTMLElement)

        expect(onChange).not.toHaveBeenCalled()
      })

      it('reorders with the arrow keys from the handle, stopping at the ends', () => {
        const { onChange } = renderWeather(on)

        fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Location' }), {
          key: 'ArrowDown',
        })
        expect(ids(lastFields(onChange)).slice(0, 2)).toEqual(['sun', 'location'])
        expect(screen.getByText('Location moved to be shown after sunrise and sunset')).toBeTruthy()

        onChange.mockClear()
        fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Location' }), {
          key: 'ArrowUp',
        })
        expect(onChange).not.toHaveBeenCalled()
      })
    })

    it('keeps the focus on a handle whose row the arrow keys moved', () => {
      function Fields() {
        const [fields, setFields] = useState(FIELDS)
        return <WeatherFields fields={fields} onChange={setFields} />
      }
      render(<Fields />)
      const handle = screen.getByRole('button', { name: 'Reorder Location' })
      handle.focus()

      fireEvent.keyDown(handle, { key: 'ArrowDown' })
      fireEvent.keyDown(handle, { key: 'ArrowDown' })

      expect(document.activeElement).toBe(handle)
      expect(screen.getAllByRole('listitem')[2]?.contains(handle)).toBe(true)
    })

    it('credits the weather data', () => {
      renderWeather({ enabled: true })

      expect(
        screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' }).getAttribute('href'),
      ).toBe('https://open-meteo.com/')
    })
  })

  describe('tour', () => {
    const TOUR: CalloutInfo[] = [
      { body: 'About the clock.', id: 'tour-clock', section: 'clock', title: 'Clock stop' },
      { body: 'About the photos.', id: 'tour-photos', section: 'photos', title: 'Photos stop' },
    ]

    const renderTour = () => {
      const onClose = vi.fn()
      render(
        <SettingsPanel
          currentId="a"
          onChange={vi.fn()}
          onClose={onClose}
          photos={PHOTOS}
          settings={settings}
          tour={TOUR}
        />,
      )
      return { onClose }
    }

    const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent

    it('opens on the section named by initialSection', () => {
      render(
        <SettingsPanel
          currentId="a"
          initialSection="weather"
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
        />,
      )

      expect(selectedTab()).toBe('Weather')
      expect(screen.queryByRole('note')).toBeNull()
    })

    it('starts on the first stop and its section', () => {
      renderTour()

      expect(selectedTab()).toBe('Clock')
      const note = screen.getByRole('note')
      expect(within(note).getByText('Clock stop')).toBeTruthy()
      expect(within(note).getByText('About the clock.')).toBeTruthy()
      expect(within(note).getByText('1 of 2')).toBeTruthy()
    })

    it('moves to the next stop and its section, and ends after the last', async () => {
      renderTour()

      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      // The note fades out first, and comes back as the next stop.
      expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(true)
      await waitFor(() => expect(selectedTab()).toBe('Photos'))
      expect(within(screen.getByRole('note')).getByText('2 of 2')).toBeTruthy()
      expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(selectedTab()).toBe('Photos')
    })

    it('follows a section opened by hand, and stays put on one it has no stop for', () => {
      renderTour()

      openSection('Photos')
      expect(within(screen.getByRole('note')).getByText('Photos stop')).toBeTruthy()

      openSection('General')
      expect(within(screen.getByRole('note')).getByText('Photos stop')).toBeTruthy()
    })

    it('ends when dismissed, without closing the settings', async () => {
      const { onClose } = renderTour()

      // A press on the note is inside the panel, not a click outside it.
      fireEvent.pointerDown(screen.getByRole('note'))
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(onClose).not.toHaveBeenCalled()

      // And it doesn't come back with the next section.
      openSection('Clock')
      expect(screen.queryByRole('note')).toBeNull()
    })
  })
})
