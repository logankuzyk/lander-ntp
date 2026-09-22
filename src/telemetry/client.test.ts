import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { fakePermissions } from '@/test/permissions'

import { TELEMETRY_URL, track } from './client'
import type { TelemetryEvent } from './events'
import { heartbeatProps } from './heartbeat'

const fetchMock = vi.fn<typeof fetch>()
const event: TelemetryEvent = { event: 'heartbeat', props: heartbeatProps(DEFAULT_SETTINGS) }

const sentBody = (call = 0) =>
  JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string) as Record<string, unknown>

beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('WXT_TELEMETRY_ENABLED', '1')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({})
  vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
    manifest_version: 3,
    name: 'Lander NTP',
    version: '1.2.3',
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

describe('track', () => {
  it('uses the production endpoint by default', () => {
    expect(TELEMETRY_URL).toBe('https://ntp.logankuzyk.com/events')
  })

  it('posts the event with the install id, version and browser', async () => {
    expect(await track(event)).toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      TELEMETRY_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        signal: expect.any(AbortSignal),
      }),
    )
    expect(sentBody()).toEqual({
      ...event,
      installId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      version: '1.2.3',
      browser: 'chrome',
    })
  })

  it('sends the same install id every time', async () => {
    await track(event)
    await track(event)

    expect(sentBody(1).installId).toBe(sentBody(0).installId)
  })

  it('sends nothing when usage data is switched off', async () => {
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, telemetry: false })

    expect(await track(event)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing from a dev build', async () => {
    vi.stubEnv('DEV', true)

    expect(await track(event)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends nothing from a build without telemetry', async () => {
    vi.stubEnv('WXT_TELEMETRY_ENABLED', undefined)

    expect(await track(event)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows network errors and refusals', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await track(event)).toBe(false)

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }))
    expect(await track(event)).toBe(false)
  })
})
