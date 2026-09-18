import { afterEach, describe, expect, it, vi } from 'vitest'

import { favouritesItem } from '@/favourites/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { track } from './client'
import {
  HEARTBEAT_INTERVAL_MS,
  heartbeatProps,
  isHeartbeatDue,
  maybeSendHeartbeat,
} from './heartbeat'
import { lastHeartbeat } from './storage'

vi.mock('./client', () => ({ track: vi.fn().mockResolvedValue(true) }))

const NOW = Date.parse('2026-09-18T12:00:00Z')
const HOUR = 60 * 60 * 1000

afterEach(() => {
  vi.mocked(track).mockClear()
})

describe('isHeartbeatDue', () => {
  it('is due when none has been sent', () => {
    expect(isHeartbeatDue(null, NOW)).toBe(true)
  })

  it('waits a day between heartbeats', () => {
    expect(isHeartbeatDue(NOW - 23 * HOUR, NOW)).toBe(false)
    expect(isHeartbeatDue(NOW - HEARTBEAT_INTERVAL_MS, NOW)).toBe(true)
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
    await maybeSendHeartbeat(NOW + 12 * HOUR)
    expect(track).toHaveBeenCalledTimes(1)

    await maybeSendHeartbeat(NOW + HEARTBEAT_INTERVAL_MS)
    expect(track).toHaveBeenCalledTimes(2)
  })

  it('waits for tomorrow after a failed send rather than retrying every tab', async () => {
    vi.mocked(track).mockResolvedValueOnce(false)

    await maybeSendHeartbeat(NOW)
    await maybeSendHeartbeat(NOW + HOUR)

    expect(track).toHaveBeenCalledTimes(1)
  })
})
