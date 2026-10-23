import { render, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { devicePosition } from './deviceLocation'
import { useDevicePosition } from './useDevicePosition'

const HERE = { latitude: 48.43, longitude: -123.37 }
const AWAY = { latitude: 49.28, longitude: -123.12 }

/** Draws where the device is, or "none", for a Weather that does or does not follow it. */
function Probe({ follow = true }: { follow?: boolean }) {
  const position = useDevicePosition(follow)
  return <output>{position ? `${position.name} ${position.latitude}` : 'none'}</output>
}

const everyShown = (container: Element) =>
  [...container.querySelectorAll('output')].map((output) => output.textContent)

/** The browser's answers: location is allowed, and the device is at `coords`. */
function device(coords = HERE) {
  const getCurrentPosition = vi.fn((done: (position: unknown) => void) => done({ coords }))
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    language: 'en-CA',
    permissions: { query: () => Promise.resolve({ state: 'granted' }) },
  })
  return getCurrentPosition
}

/** Answers the name lookup with a town, and counts the lookups. */
function naming(city: string) {
  const fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ city }), ok: true }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDevicePosition', () => {
  it('finds, names and remembers the position for a Weather that follows the device', async () => {
    device()
    naming('Victoria')

    const { container } = render(<Probe />)

    await waitFor(() => expect(everyShown(container)).toEqual(['Victoria 48.43']))
    expect(await devicePosition.getValue()).toEqual({ ...HERE, name: 'Victoria' })
  })

  it('locates the device and looks up its town once for two Weathers that follow it', async () => {
    const getCurrentPosition = device()
    const fetch = naming('Victoria')

    const { container } = render(
      <>
        <Probe />
        <Probe />
      </>,
    )

    await waitFor(() => expect(everyShown(container)).toEqual(['Victoria 48.43', 'Victoria 48.43']))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gives a Weather that starts following later the position already found, without asking again', async () => {
    const getCurrentPosition = device()
    const fetch = naming('Victoria')
    const first = render(<Probe />)
    await waitFor(() => expect(everyShown(first.container)).toEqual(['Victoria 48.43']))

    const second = render(<Probe />)

    await waitFor(() => expect(everyShown(second.container)).toEqual(['Victoria 48.43']))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not ask for a Weather that does not follow the device, nor draw a position for it', async () => {
    const getCurrentPosition = device()
    const fetch = naming('Victoria')

    const { container } = render(
      <>
        <Probe />
        <Probe follow={false} />
      </>,
    )

    await waitFor(() => expect(everyShown(container)[0]).toBe('Victoria 48.43'))
    expect(everyShown(container)[1]).toBe('none')
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps following for the Weathers that remain when one stops', async () => {
    device()
    naming('Victoria')
    const stays = render(<Probe />)
    const goes = render(<Probe />)
    await waitFor(() => expect(everyShown(goes.container)).toEqual(['Victoria 48.43']))
    goes.unmount()

    // Settings pick the position again, as they do while a tab is open.
    await devicePosition.setValue({ ...AWAY, name: 'Vancouver' })

    await waitFor(() => expect(everyShown(stays.container)).toEqual(['Vancouver 49.28']))
  })

  it('tells every Weather when settings pick the position again while the tab is open', async () => {
    device()
    naming('Victoria')
    const { container } = render(
      <>
        <Probe />
        <Probe />
      </>,
    )
    await waitFor(() => expect(everyShown(container)).toEqual(['Victoria 48.43', 'Victoria 48.43']))

    await devicePosition.setValue({ ...AWAY, name: 'Vancouver' })

    await waitFor(() =>
      expect(everyShown(container)).toEqual(['Vancouver 49.28', 'Vancouver 49.28']),
    )
  })

  it('locates again for a Weather that follows once none were following', async () => {
    const getCurrentPosition = device()
    naming('Victoria')
    const first = render(<Probe />)
    await waitFor(() => expect(everyShown(first.container)).toEqual(['Victoria 48.43']))
    first.unmount()

    const second = render(<Probe />)

    await waitFor(() => expect(everyShown(second.container)).toEqual(['Victoria 48.43']))
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
  })
})
