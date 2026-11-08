import { browser } from 'wxt/browser'
import { storage } from 'wxt/utils/storage'

import { account } from '@/account/account'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { syncClient } from '@/sync/client'
import { syncedShapes } from '@/sync/shapes'

import {
  readFrozenAccount,
  readFrozenOnboarding,
  readFrozenSettings,
  readFrozenSyncChoice,
} from './frozenReaders'

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

const login = () => json({ token: 'account-token', user: { email: 'person@example.com' } })
const signedIn = () => json({ email: 'person@example.com', pending: false })
const syncChoice = storage.defineItem<unknown>('local:sync-choice', { fallback: null })

const syncWrites: { assert: () => Promise<void>; commit: () => Promise<void>; name: string }[] = [
  {
    assert: async () => {
      expect(syncedShapes.settings.check(await readFrozenSettings())).toEqual({ ok: true, v: 1 })
      expect(await readFrozenSettings()).toMatchObject({ dim: false, v: 1 })
      expect(syncedShapes.onboarding.check(await readFrozenOnboarding())).toEqual({
        ok: true,
        v: 1,
      })
      expect(await readFrozenOnboarding()).toMatchObject({
        dismissed: ['account-callout', 'browser-callout'],
        welcomed: true,
      })
      expect(await readFrozenSyncChoice()).toEqual({
        email: 'person@example.com',
        state: 'complete',
      })
    },
    commit: async () => {
      const local = { ...DEFAULT_SETTINGS, dim: false, v: 1 }
      const remote = { ...DEFAULT_SETTINGS, font: 'geist', v: 1 }
      await browser.storage.sync.set({
        onboarding: { dismissed: ['browser-callout'], v: 1, welcomed: false },
      })
      await browser.storage.local.set({ account: { email: 'person@example.com', token: 'token' } })
      await syncChoice.setValue({
        email: 'person@example.com',
        local: {
          onboarding: { dismissed: ['browser-callout'], welcomed: false },
          settings: local,
        },
        remote: {
          onboarding: { dismissed: ['account-callout'], v: 1, welcomed: true },
          settings: remote,
        },
        rev: 1,
        state: 'needs-choice',
        v: 1,
      })
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(json({ changed: true, rev: 2 })),
      )
      await syncClient.choose('browser')
    },
    name: 'sync:settings, sync:onboarding and local:sync-choice from a browser choice',
  },
  {
    assert: async () => {
      expect(await readFrozenSyncChoice()).toMatchObject({
        email: 'person@example.com',
        local: { settings: { dim: false } },
        remote: { settings: { font: 'geist' } },
        rev: 1,
      })
    },
    commit: async () => {
      const local = { ...DEFAULT_SETTINGS, dim: false }
      await settingsItem.setValue(local)
      await browser.storage.local.set({ account: { email: 'person@example.com', token: 'token' } })
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          json({
            items: {
              settings: { v: 1, value: { ...DEFAULT_SETTINGS, font: 'geist', v: 1 } },
            },
            rev: 1,
          }),
        ),
      )
      await syncClient.initialize()
    },
    name: 'local:sync-choice from a first-sign-in pause',
  },
]

const writes: {
  commit: () => Promise<void>
  expected: { email: string; token: string } | null
  name: string
}[] = [
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValueOnce(login()).mockResolvedValueOnce(signedIn()),
      )
      await account.verify('person@example.com', '123456')
    },
    expected: { email: 'person@example.com', token: 'account-token' },
    name: 'local:account from verify',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(login())
          .mockResolvedValueOnce(signedIn())
          .mockResolvedValueOnce(new Response(null, { status: 204 })),
      )
      await account.verify('person@example.com', '123456')
      await account.signOut()
    },
    expected: null,
    name: 'local:account from successful signOut',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(login())
          .mockResolvedValueOnce(signedIn())
          .mockResolvedValueOnce(new Response(null, { status: 204 })),
      )
      await account.verify('person@example.com', '123456')
      await account.deleteAccount()
    },
    expected: null,
    name: 'local:account clear after deleteAccount',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(login())
          .mockResolvedValueOnce(signedIn())
          .mockResolvedValueOnce(
            json({
              devices: [
                {
                  browser: 'Firefox',
                  createdAt: '2026-10-01T00:00:00.000Z',
                  current: true,
                  id: 'current-device',
                  lastUsedAt: '2026-10-01T00:00:00.000Z',
                  os: 'Linux',
                },
              ],
              limit: 3,
              pending: false,
            }),
          )
          .mockResolvedValueOnce(new Response(null, { status: 204 })),
      )
      await account.verify('person@example.com', '123456')
      await account.devices()
      await account.removeDevice('current-device')
    },
    expected: null,
    name: 'local:account clear after current device removal',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(login())
          .mockResolvedValueOnce(signedIn())
          .mockRejectedValueOnce(new TypeError('offline')),
      )
      await account.verify('person@example.com', '123456')
      await account.signOut()
    },
    expected: null,
    name: 'local:account stale token from unavailable signOut',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(login())
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'signed_out' }), { status: 401 }),
          ),
      )
      await account.verify('person@example.com', '123456')
    },
    expected: null,
    name: 'local:account clear after 401',
  },
  {
    commit: async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValueOnce(login()).mockResolvedValueOnce(signedIn()),
      )
      await account.verify('person@example.com', '123456')
      vi.stubEnv('BROWSER', 'firefox')
      vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false as never)
      await account.initialize()
    },
    expected: null,
    name: 'local:account stale token after consent withdrawal',
  },
]

describe('stored account compatibility', () => {
  beforeEach(async () => {
    await browser.storage.local.clear()
    await browser.storage.sync.clear()
    vi.stubEnv('BROWSER', 'chrome')
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(writes)('$name remains readable by the frozen reader', async ({ commit, expected }) => {
    await commit()

    expect(await readFrozenAccount()).toEqual(expected)
  })

  it.each(syncWrites)('$name remains readable by frozen readers', async ({ assert, commit }) => {
    await commit()
    await assert()
  })
})
