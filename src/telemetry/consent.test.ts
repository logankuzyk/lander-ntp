import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { fakePermissions } from '@/test/permissions'

import {
  browserConsent,
  buildSends,
  DATA_COLLECTION,
  isTelemetryEnabled,
  setBrowserConsent,
} from './consent'

const chrome = () => vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({})

const firefox = (granted: string[]) =>
  vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({ data_collection: granted })

beforeEach(() => {
  vi.stubEnv('DEV', false)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('buildSends', () => {
  it('sends from a production build', () => {
    expect(buildSends()).toBe(true)
  })

  it('keeps a dev build quiet', () => {
    vi.stubEnv('DEV', true)

    expect(buildSends()).toBe(false)
  })

  it('lets a dev build send when asked to', () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('WXT_TELEMETRY_DEV', '1')

    expect(buildSends()).toBe(true)
  })
})

describe('browserConsent', () => {
  it('has no say on Chrome and Edge', async () => {
    chrome()

    expect(await browserConsent()).toBeNull()
  })

  it("follows Firefox's usage data switch", async () => {
    firefox([DATA_COLLECTION])
    expect(await browserConsent()).toBe(true)

    vi.restoreAllMocks()
    firefox([])
    expect(await browserConsent()).toBe(false)
  })
})

describe('isTelemetryEnabled', () => {
  it('is on by default on Chrome and Edge', async () => {
    chrome()

    expect(await isTelemetryEnabled(DEFAULT_SETTINGS)).toBe(true)
  })

  it('is off when switched off in settings', async () => {
    chrome()

    expect(await isTelemetryEnabled({ ...DEFAULT_SETTINGS, telemetry: false })).toBe(false)
  })

  it('needs Firefox consent as well as the setting', async () => {
    firefox([])

    expect(await isTelemetryEnabled(DEFAULT_SETTINGS)).toBe(false)
  })

  it('is on in Firefox once both agree', async () => {
    firefox([DATA_COLLECTION])

    expect(await isTelemetryEnabled(DEFAULT_SETTINGS)).toBe(true)
  })

  it('is off in a dev build without asking the browser', async () => {
    vi.stubEnv('DEV', true)
    const getAll = chrome()

    expect(await isTelemetryEnabled(DEFAULT_SETTINGS)).toBe(false)
    expect(getAll).not.toHaveBeenCalled()
  })
})

describe('setBrowserConsent', () => {
  it("asks Firefox for usage data and resolves to the user's answer", async () => {
    const request = vi.spyOn(fakePermissions, 'request').mockResolvedValue(true)

    expect(await setBrowserConsent(true)).toBe(true)
    expect(request).toHaveBeenCalledWith({ data_collection: [DATA_COLLECTION] })
  })

  it('withdraws it, resolving to false once removed', async () => {
    const remove = vi.spyOn(fakePermissions, 'remove').mockResolvedValue(true)

    expect(await setBrowserConsent(false)).toBe(false)
    expect(remove).toHaveBeenCalledWith({ data_collection: [DATA_COLLECTION] })
  })
})
