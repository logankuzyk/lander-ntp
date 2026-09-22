import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { favouritesItem } from '@/favourites/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { fakePermissions } from '@/test/permissions'

import { track } from './client'
import { heartbeatProps, isHeartbeatDue, maybeSendHeartbeat } from './heartbeat'
import { lastHeartbeat } from './storage'

vi.mock('./client', () => ({ track: vi.fn().mockResolvedValue(true) }))

const NOW = Date.parse('2026-09-18T12:00:00Z')
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('WXT_TELEMETRY_ENABLED', '1')
  // Chrome: the setting alone decides.
  vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({})
})

afterEach(() => {
  vi.mocked(track).mockClear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('isHeartbeatDue', () => {
  it('is due when none has been sent', () => {
    expect(isHeartbeatDue(null, NOW)).toBe(true)
  })

  it('waits for the next UTC day', () => {
    expect(isHeartbeatDue(NOW - 11 * HOUR, NOW)).toBe(false)
    expect(isHeartbeatDue(Date.parse('2026-09-17T23:59:59Z'), NOW)).toBe(true)
  })

  it('does not wait a full 24 hours, so a daily user is counted every day', () => {
    const lateLastNight = Date.parse('2026-09-17T22:00:00Z')

    expect(isHeartbeatDue(lateLastNight, Date.parse('2026-09-18T08:00:00Z'))).toBe(true)
  })

  it('is due if the clock has gone back past the last one', () => {
    expect(isHeartbeatDue(NOW + HOUR, NOW)).toBe(true)
  })
})

describe('heartbeatProps', () => {
  it('reports the settings and how many favourites there are', () => {
    expect(heartbeatProps(DEFAULT_SETTINGS, 3)).toEqual({
      frequency: DEFAULT_SETTINGS.frequency,
      font: DEFAULT_SETTINGS.font,
      dim: DEFAULT_SETTINGS.dim,
      clock: DEFAULT_SETTINGS.clock,
      favourites: { ...DEFAULT_SETTINGS.favourites, count: 3 },
    })
  })

  it('leaves out settings it does not name', () => {
    const later = { ...DEFAULT_SETTINGS, weather: { location: 'Victoria, BC' } } as Settings

    expect(JSON.stringify(heartbeatProps(later, 0))).not.toContain('Victoria')
  })
})

describe('maybeSendHeartbeat', () => {
  it('sends the stored settings and favourites count on the first visit', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, frequency: 'daily' })
    await favouritesItem.setValue([{ id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' }])

    await maybeSendHeartbeat(NOW)

    expect(track).toHaveBeenCalledWith({
      event: 'heartbeat',
      props: heartbeatProps({ ...DEFAULT_SETTINGS, frequency: 'daily' }, 1),
    })
    expect(await lastHeartbeat.getValue()).toBe(NOW)
  })

  it('sends one a day however many tabs are opened', async () => {
    await maybeSendHeartbeat(NOW)
    await maybeSendHeartbeat(NOW + HOUR)
    await maybeSendHeartbeat(NOW + 11 * HOUR)
    expect(track).toHaveBeenCalledTimes(1)

    await maybeSendHeartbeat(NOW + 12 * HOUR)
    expect(track).toHaveBeenCalledTimes(2)
  })

  it('sends one for tabs opened together, where the browser can lock', async () => {
    // A minimal LockManager: each request runs once the one before it has finished.
    let queue: Promise<unknown> = Promise.resolve()
    const locks = {
      request: (_name: string, callback: () => Promise<unknown>) => {
        const run = queue.then(callback)
        queue = run.catch(() => undefined)
        return run
      },
    }
    vi.spyOn(navigator, 'locks', 'get').mockReturnValue(locks as unknown as LockManager)

    await Promise.all([maybeSendHeartbeat(NOW), maybeSendHeartbeat(NOW), maybeSendHeartbeat(NOW)])

    expect(track).toHaveBeenCalledTimes(1)
  })

  it('leaves the day unclaimed while usage data is off, so switching it on sends that day', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, telemetry: false })
    await maybeSendHeartbeat(NOW)
    expect(track).not.toHaveBeenCalled()
    expect(await lastHeartbeat.getValue()).toBeNull()

    await settingsItem.setValue({ ...DEFAULT_SETTINGS, telemetry: true })
    await maybeSendHeartbeat(NOW + HOUR)
    expect(track).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a build without telemetry', async () => {
    vi.stubEnv('WXT_TELEMETRY_ENABLED', undefined)

    await maybeSendHeartbeat(NOW)

    expect(track).not.toHaveBeenCalled()
    expect(await lastHeartbeat.getValue()).toBeNull()
  })

  it('waits for tomorrow after a failed send rather than retrying every tab', async () => {
    vi.mocked(track).mockResolvedValueOnce(false)

    await maybeSendHeartbeat(NOW)
    await maybeSendHeartbeat(NOW + HOUR)

    expect(track).toHaveBeenCalledTimes(1)
  })
})
