import { browser } from 'wxt/browser'

import { account } from '@/account/account'

import { readFrozenAccount } from './frozenReaders'

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

const login = () => json({ token: 'account-token', user: { email: 'person@example.com' } })
const signedIn = () => json({ email: 'person@example.com', pending: false })

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
})
