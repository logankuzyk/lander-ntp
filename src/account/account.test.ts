import { browser } from 'wxt/browser'

import { account } from './account'
import config from './config'

const response = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  })

describe('account', () => {
  beforeEach(async () => {
    await browser.storage.local.clear()
    vi.stubEnv('BROWSER', 'firefox')
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(true as never)
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { success: true })))
    await account.initialize()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('asks for consent inside Send code before making the request', async () => {
    const order: string[] = []
    vi.spyOn(browser.permissions, 'request').mockImplementation(async () => {
      order.push('permission')
      return true as never
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        order.push('fetch')
        return response(200, { success: true })
      }),
    )

    await expect(account.sendCode('person@example.com')).resolves.toMatchObject({ ok: true })
    expect(order).toEqual(['permission', 'fetch'])
  })

  it('does not send a code when Firefox consent is refused', async () => {
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(false as never)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    await expect(account.sendCode('person@example.com')).resolves.toMatchObject({
      error: 'consent-refused',
      ok: false,
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(account.state).toMatchObject({ notice: 'paused-no-consent' })
  })

  it('does not send a code when Chrome host access is refused', async () => {
    vi.stubEnv('BROWSER', 'chrome')
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(false as never)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    await expect(account.sendCode('person@example.com')).resolves.toMatchObject({
      error: 'consent-refused',
      ok: false,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('requests a code, verifies it, and then reports the signed-in account', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { success: true }))
      .mockResolvedValueOnce(
        response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
    vi.stubGlobal('fetch', fetcher)

    await expect(account.sendCode('person@example.com')).resolves.toMatchObject({ ok: true })
    await expect(account.verify('person@example.com', '123456')).resolves.toMatchObject({
      ok: true,
    })

    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `${config.serverUrl}/api/auth/email-otp/send-verification-otp`,
      `${config.serverUrl}/api/auth/sign-in/email-otp`,
      `${config.serverUrl}/v1/me`,
    ])
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      email: 'person@example.com',
      type: 'sign-in',
    })
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      email: 'person@example.com',
      otp: '123456',
    })
    expect(fetcher.mock.calls.every(([, init]) => init?.credentials === 'omit')).toBe(true)
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('authorization')).toBe(false)
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('authorization')).toBe(
      'Bearer token-a',
    )
    expect(account.state).toEqual({
      email: 'person@example.com',
      notice: 'none',
      status: 'signed-in',
    })
  })

  it('reports a pending device and loads the device list after verification', async () => {
    const devices = [
      {
        browser: 'Firefox',
        createdAt: '2026-01-01T00:00:00.000Z',
        current: true,
        id: 'device/a',
        lastUsedAt: '2026-01-02T00:00:00.000Z',
        os: 'Linux',
      },
    ]
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
        )
        .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: true }))
        .mockResolvedValueOnce(response(200, { devices, limit: 3, pending: true })),
    )

    await account.verify('person@example.com', '123456')

    expect(account.state).toEqual({
      devices,
      email: 'person@example.com',
      notice: 'none',
      status: 'pending-device',
    })
  })

  it('lists and removes devices, then deletes the account with bearer requests', async () => {
    const devices = [
      {
        browser: 'Firefox',
        createdAt: '2026-01-01T00:00:00.000Z',
        current: true,
        id: 'device/a',
        lastUsedAt: '2026-01-02T00:00:00.000Z',
        os: 'Linux',
      },
    ]
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
      .mockResolvedValueOnce(response(200, { devices, limit: 3, pending: false }))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(204))
    vi.stubGlobal('fetch', fetcher)
    await account.verify('person@example.com', '123456')

    await expect(account.devices()).resolves.toEqual({ ok: true, value: devices })
    await expect(account.removeDevice('device/a')).resolves.toMatchObject({ ok: true })
    await expect(account.deleteAccount()).resolves.toMatchObject({ ok: true })

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('/api/auth/sign-in/email-otp'),
      expect.stringContaining('/v1/me'),
      expect.stringContaining('/v1/devices'),
      `${config.serverUrl}/v1/devices/device%2Fa`,
      expect.stringContaining('/v1/account'),
    ])
    expect(fetcher.mock.calls.slice(2).every(([, init]) => init?.credentials === 'omit')).toBe(true)
    expect(
      fetcher.mock.calls
        .slice(2)
        .every(([, init]) => new Headers(init?.headers).get('authorization') === 'Bearer token-a'),
    ).toBe(true)
    expect(account.state.status).toBe('signed-out')
    expect(await browser.storage.local.get('account')).toEqual({})
  })

  it('clears the saved token and announces sign-out elsewhere on a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
        )
        .mockResolvedValueOnce(response(401, { error: 'signed_out' })),
    )

    await account.verify('person@example.com', '123456')

    expect(account.state).toMatchObject({ notice: 'signed-out-elsewhere', status: 'signed-out' })
    expect(await browser.storage.local.get('account')).toEqual({})
    expect(await browser.storage.sync.get(null)).toEqual({})
  })

  it('uses the entered email when /v1/me omits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
        )
        .mockResolvedValueOnce(response(200, { pending: false })),
    )

    await account.verify('person@example.com', '123456')

    expect(account.state).toEqual({
      email: 'person@example.com',
      notice: 'none',
      status: 'signed-in',
    })
  })

  it('returns a typed network error instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(account.sendCode('person@example.com')).resolves.toEqual({
      error: 'network-error',
      ok: false,
    })
  })

  it('keeps HTTP errors distinct from network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, { error: 'rate_limited' })))

    await expect(account.sendCode('person@example.com')).resolves.toEqual({
      error: 'http-error',
      ok: false,
    })
  })

  it('returns an invalid-response result when a successful response has invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))

    await expect(account.sendCode('person@example.com')).resolves.toEqual({
      error: 'invalid-response',
      ok: false,
    })
  })

  it('keeps the signed-out notice clear when there is no stored token', async () => {
    await account.signOut()

    expect(account.state).toEqual({ notice: 'none', status: 'signed-out' })
  })

  it('refreshes account state when the tab becomes visible, not when it is hidden', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
    vi.stubGlobal('fetch', fetcher)
    await account.verify('person@example.com', '123456')
    const visibility = vi.spyOn(document, 'visibilityState', 'get')

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetcher).toHaveBeenCalledTimes(2)

    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('keeps an older stale token after successful sign-out so a later sign-in can revoke it', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { token: 'token-a', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(
        response(200, { token: 'token-b', user: { email: 'person@example.com' } }),
      )
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(
        response(200, { token: 'token-c', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { success: true }))
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
    vi.stubGlobal('fetch', fetcher)

    await account.verify('person@example.com', '111111')
    await account.signOut()
    await account.verify('person@example.com', '222222')
    await account.signOut()
    await account.verify('person@example.com', '333333')

    expect(new Headers(fetcher.mock.calls[8]?.[1]?.headers).get('authorization')).toBe(
      'Bearer token-a',
    )
  })

  it('does not make account requests after consent is withdrawn', async () => {
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false as never)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    await account.initialize()

    expect(fetcher).not.toHaveBeenCalled()
    expect(account.state).toMatchObject({ notice: 'paused-no-consent', status: 'signed-out' })
  })

  it('keeps page storage untouched when sign-out cannot reach the server and retries the old token after sign-in', async () => {
    const pageItem = { preserved: true }
    await browser.storage.local.set({ pageItem })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, { token: 'old-token', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        response(200, { token: 'new-token', user: { email: 'person@example.com' } }),
      )
      .mockResolvedValueOnce(response(200, { success: true }))
      .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false }))
    vi.stubGlobal('fetch', fetcher)

    await account.verify('person@example.com', '123456')
    await expect(account.signOut()).resolves.toMatchObject({ error: 'network-error', ok: false })
    expect(await browser.storage.local.get('pageItem')).toEqual({ pageItem })
    expect(account.state.status).toBe('signed-out')

    await account.verify('person@example.com', '654321')
    expect(new Headers(fetcher.mock.calls[4]?.[1]?.headers).get('authorization')).toBe(
      'Bearer old-token',
    )
  })

  it('keeps account credentials in local storage and out of every other storage area', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          response(200, { token: 'secret-token', user: { email: 'person@example.com' } }),
        )
        .mockResolvedValueOnce(response(200, { email: 'person@example.com', pending: false })),
    )

    await account.verify('person@example.com', '123456')

    for (const [name, area] of Object.entries(browser.storage)) {
      if (typeof area !== 'object' || area === null || !('get' in area)) continue
      const value = await (area as { get: (key: null) => Promise<unknown> }).get(null)
      if (name === 'local') {
        expect(value).toMatchObject({
          account: { email: 'person@example.com', token: 'secret-token' },
        })
      } else {
        expect(JSON.stringify(value)).not.toContain('secret-token')
      }
    }
  })
})
