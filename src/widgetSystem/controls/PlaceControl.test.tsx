import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { devicePosition } from '@/weather/deviceLocation'

import type { PlaceValue } from '../definition'
import { PlaceControl } from './PlaceControl'

const VICTORIA = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }
const EMPTY: PlaceValue = { followDevice: false, place: null }

const draw = (value: PlaceValue) => {
  const onChange = vi.fn()
  const view = (current: PlaceValue) => (
    <PlaceControl label="Place" onChange={onChange} value={current} />
  )
  const rendered = render(view(value))
  return { onChange, rerender: (next: PlaceValue) => rendered.rerender(view(next)) }
}

const search = () => screen.getByRole('combobox', { name: 'Search for a place' })

/** The suggestion under the search box, there once the box is focused. */
const currentLocation = () => {
  fireEvent.focus(search())
  fireEvent.click(screen.getByRole('option', { name: 'Current location' }))
}

const locating = (coords: { latitude: number; longitude: number } | null) =>
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (done: (position: unknown) => void, fail: () => void) =>
        coords ? done({ coords }) : fail(),
    },
    language: 'en-CA',
  })

const answering = (body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body), ok: true }))

describe('PlaceControl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('with no place', () => {
    it('is the search box, with no row of its own', () => {
      const { container } = render(<PlaceControl label="Place" onChange={vi.fn()} value={EMPTY} />)

      expect(search()).toBeTruthy()
      expect(container.querySelector('.settings__row')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Change' })).toBeNull()
    })

    it('sets the place picked and stops following the device, in one change', async () => {
      answering({
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
      })
      const { onChange } = draw(EMPTY)

      fireEvent.input(search(), { target: { value: 'Victoria' } })
      fireEvent.click(
        await screen.findByRole('option', { name: 'Victoria, British Columbia, Canada' }),
      )

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({ followDevice: false, place: VICTORIA })
    })

    it('suggests the current location while the box has focus', () => {
      draw(EMPTY)
      expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()

      fireEvent.focus(search())

      expect(screen.getByRole('option', { name: 'Current location' })).toBeTruthy()
    })
  })

  describe('with a place', () => {
    it('names it in a row with the label, beside a Change button', () => {
      const { container } = render(
        <PlaceControl
          label="Place"
          onChange={vi.fn()}
          value={{ followDevice: false, place: VICTORIA }}
        />,
      )

      const row = container.querySelector('.settings__row')
      expect(row?.firstElementChild?.textContent).toBe('Place')
      expect(row?.lastElementChild?.textContent).toBe('Victoria Change')
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
    })

    it('brings the search back to change it, and says nothing until one is picked', () => {
      const { onChange } = draw({ followDevice: false, place: VICTORIA })

      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      expect(search()).toBeTruthy()
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('following the device', () => {
    it('says Current location whatever place is kept, and Change brings the search', () => {
      draw({ followDevice: true, place: VICTORIA })

      expect(screen.getByText(/^Current location/)).toBeTruthy()
      expect(screen.queryByText('Victoria')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Change' }))
      expect(search()).toBeTruthy()
    })

    it('says so with no place kept at all', () => {
      draw({ followDevice: true, place: null })

      expect(screen.getByText(/^Current location/)).toBeTruthy()
    })

    it('stops following when a place is picked', async () => {
      answering({
        results: [
          { country: 'Canada', id: 1, latitude: 48.4359, longitude: -123.35155, name: 'Victoria' },
        ],
      })
      const { onChange } = draw({ followDevice: true, place: null })
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      fireEvent.input(search(), { target: { value: 'Victoria' } })
      fireEvent.click(await screen.findByRole('option', { name: 'Victoria, Canada' }))

      expect(onChange).toHaveBeenCalledWith({ followDevice: false, place: VICTORIA })
    })
  })

  describe('using the device location', () => {
    it('keeps the position on the device and follows it, leaving the place as it was', async () => {
      locating({ latitude: 48.4359, longitude: -123.35155 })
      answering({ city: 'Victoria' })
      const { onChange } = draw({ followDevice: false, place: { ...VICTORIA, name: 'Sidney' } })
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      currentLocation()

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({
          followDevice: true,
          place: { ...VICTORIA, name: 'Sidney' },
        }),
      )
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(await devicePosition.getValue()).toEqual({
        latitude: 48.44,
        longitude: -123.35,
        name: 'Victoria',
      })
    })

    it('puts the position away before it says it follows', async () => {
      locating({ latitude: 48.4359, longitude: -123.35155 })
      answering({ city: 'Victoria' })
      const { onChange } = draw(EMPTY)
      let positionWhenTold: unknown = 'never told'
      onChange.mockImplementation(
        () => void devicePosition.getValue().then((p) => (positionWhenTold = p)),
      )

      currentLocation()

      await waitFor(() => expect(onChange).toHaveBeenCalled())
      await waitFor(() =>
        expect(positionWhenTold).toEqual(expect.objectContaining({ name: 'Victoria' })),
      )
    })

    it('keeps the position without a name when none could be had', async () => {
      locating({ latitude: 48.4359, longitude: -123.35155 })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const { onChange } = draw(EMPTY)

      currentLocation()

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ followDevice: true, place: null }),
      )
      expect(await devicePosition.getValue()).toEqual({
        latitude: 48.44,
        longitude: -123.35,
        name: null,
      })
    })

    it('puts the place the value has by then in the change, and asks the browser only once', async () => {
      let found: (position: unknown) => void = () => {}
      const getCurrentPosition = vi.fn((done: typeof found) => {
        found = done
      })
      vi.stubGlobal('navigator', { geolocation: { getCurrentPosition }, language: 'en-CA' })
      answering({ city: 'Victoria' })
      const { onChange, rerender } = draw(EMPTY)

      currentLocation()
      currentLocation()
      rerender({ followDevice: false, place: VICTORIA })
      found({ coords: { latitude: 48.4359, longitude: -123.35155 } })

      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith({ followDevice: true, place: VICTORIA }),
      )
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it('can be asked again once the first ask is answered', async () => {
      locating({ latitude: 48.4359, longitude: -123.35155 })
      answering({ city: 'Victoria' })
      const { onChange } = draw(EMPTY)

      currentLocation()
      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
      currentLocation()

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    })

    it('says so when the position is refused, and changes nothing', async () => {
      locating(null)
      const { onChange } = draw(EMPTY)

      currentLocation()

      expect(await screen.findByText(/Couldn’t get your location/)).toBeTruthy()
      expect(onChange).not.toHaveBeenCalled()
      expect(await devicePosition.getValue()).toBeNull()
    })

    it('stops saying so on the next try', async () => {
      locating(null)
      draw(EMPTY)
      currentLocation()
      await screen.findByText(/Couldn’t get your location/)

      locating({ latitude: 48.4359, longitude: -123.35155 })
      answering({ city: 'Victoria' })
      currentLocation()

      await waitFor(() => expect(screen.queryByText(/Couldn’t get your location/)).toBeNull())
    })
  })

  describe('kept by a parent that takes each change', () => {
    function Parent({ label = 'Place', start }: { label?: string; start: PlaceValue }) {
      const [value, setValue] = useState(start)
      return <PlaceControl label={label} onChange={setValue} value={value} />
    }
    const row = () => document.querySelector('.settings__row')

    it('goes back to the row, naming the device, once the current location is chosen', async () => {
      locating({ latitude: 48.4359, longitude: -123.35155 })
      answering({ city: 'Victoria' })
      render(<Parent start={{ followDevice: false, place: VICTORIA }} />)
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      currentLocation()

      await waitFor(() => expect(row()?.textContent).toBe('PlaceCurrent location Change'))
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
    })

    it('goes back to the row, naming the place, once another is picked', async () => {
      answering({
        results: [
          { country: 'Canada', id: 1, latitude: 48.4359, longitude: -123.35155, name: 'Sidney' },
        ],
      })
      render(<Parent start={{ followDevice: false, place: VICTORIA }} />)
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      fireEvent.input(search(), { target: { value: 'Sidney' } })
      fireEvent.click(await screen.findByRole('option', { name: 'Sidney, Canada' }))

      expect(row()?.textContent).toBe('PlaceSidney Change')
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
    })

    it('calls the row whatever the label it is given', () => {
      render(<Parent label="Where" start={{ followDevice: false, place: VICTORIA }} />)

      expect(row()?.firstElementChild?.textContent).toBe('Where')
      expect(screen.queryByText('Place')).toBeNull()
    })
  })

  describe('disabled', () => {
    it('shows the place, with a Change button that does nothing', () => {
      const onChange = vi.fn()
      render(
        <PlaceControl
          disabled
          label="Place"
          onChange={onChange}
          value={{ followDevice: false, place: VICTORIA }}
        />,
      )
      const change = screen.getByRole('button', { name: 'Change' }) as HTMLButtonElement
      fireEvent.click(change)

      expect(change.disabled).toBe(true)
      expect(screen.getByText(/^Victoria/)).toBeTruthy()
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows the search box without a place, which cannot be typed in', () => {
      render(<PlaceControl disabled label="Place" onChange={vi.fn()} value={EMPTY} />)

      expect((search() as HTMLInputElement).disabled).toBe(true)
    })
  })
})
