import { afterEach, describe, expect, it, vi } from 'vitest'

import { askForLocation } from './deviceLocation'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** A browser whose position is answered by hand. */
function browserAsking() {
  let succeed!: (position: unknown) => void
  let fail!: (error: unknown) => void
  const getCurrentPosition = vi.fn((done: typeof succeed, failed: typeof fail) => {
    succeed = done
    fail = failed
  })
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
  return {
    fail: (error: unknown = { code: 1 }) => fail(error),
    getCurrentPosition,
    succeed: () => succeed({ coords: { latitude: 48.4321, longitude: -123.3712 } }),
  }
}

describe('askForLocation', () => {
  it('asks the browser before it returns, since the prompt belongs to the click that called it', () => {
    const asking = browserAsking()

    void askForLocation()

    expect(asking.getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('gives the position, rounded, when the browser answers', async () => {
    const asking = browserAsking()
    const answer = askForLocation()

    asking.succeed()

    await expect(answer).resolves.toEqual({ latitude: 48.43, longitude: -123.37 })
  })

  it('gives nothing when the browser says no', async () => {
    const asking = browserAsking()
    const answer = askForLocation()

    asking.fail()

    await expect(answer).resolves.toBeNull()
  })

  it('gives nothing, rather than waiting for ever, when a prompt is never answered', async () => {
    vi.useFakeTimers()
    browserAsking()
    const answer = askForLocation(5000)
    let settled = false
    void answer.then(() => (settled = true))

    await vi.advanceTimersByTimeAsync(4999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    await expect(answer).resolves.toBeNull()
  })

  it('leaves no timer running once the browser has answered', async () => {
    vi.useFakeTimers()
    const asking = browserAsking()
    const answer = askForLocation()
    asking.succeed()
    await answer

    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives nothing at once on a browser with no location', async () => {
    vi.stubGlobal('navigator', {})

    await expect(askForLocation()).resolves.toBeNull()
  })
})
