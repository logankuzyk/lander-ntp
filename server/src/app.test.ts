import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'
import { createConsoleMailer } from './auth.js'
import type { ServerConfig } from './config.js'
import type { ObjectStore } from './objectStore.js'

const databases: DatabaseSync[] = []
let testClientAddress = 1

type MailMessage = { subject: string; text: string; to: string }

async function makeApp() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  return createApp({
    clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
    config: {
      authSecret: 'a'.repeat(32),
      databasePath: ':memory:',
      nodeEnv: 'test',
      port: 3000,
      trustAnyExtensionOrigin: false,
      trustedExtensionIds: ['ocglhjclnhfbgbccffinhioaangigioa'],
    },
    db,
    getClientAddress: (context) => new URL(context.req.url).hostname,
    mailer: { send: async () => undefined },
    objectStore: {
      delete: async () => undefined,
      get: async () => undefined,
      list: async () => [],
      put: async () => undefined,
    },
  })
}

async function makeAuthApp(
  configOverrides: Partial<ServerConfig> = {},
  now: () => Date = () => new Date('2026-01-01T00:00:00.000Z'),
  objectStoreOverrides: Partial<ObjectStore> = {},
) {
  const messages: MailMessage[] = []
  const publishedObjects: { key: string; value: Uint8Array }[] = []
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const config: ServerConfig = {
    authSecret: 'a'.repeat(32),
    databasePath: ':memory:',
    nodeEnv: 'test',
    port: 3000,
    trustAnyExtensionOrigin: false,
    trustedExtensionIds: ['ocglhjclnhfbgbccffinhioaangigioa'],
    trustProxyHeader: 'x-test-client-ip',
    ...configOverrides,
  }
  const app = await createApp({
    clock: { now },
    config,
    db,
    getClientAddress: (context) => new URL(context.req.url).hostname,
    mailer: {
      send: async (message) => {
        messages.push(message as MailMessage)
      },
    },
    objectStore: {
      delete: async () => undefined,
      get: async () => undefined,
      list: async () => [],
      put: async (key, value) => {
        publishedObjects.push({ key, value })
        await objectStoreOverrides.put?.(key, value)
      },
      ...objectStoreOverrides,
    },
  })
  const clientIp = `203.0.113.${testClientAddress++}`
  const request = app.request.bind(app)
  app.request = (input, init) => {
    const headers = new Headers(init?.headers)
    if (config.trustProxyHeader && !headers.has(config.trustProxyHeader)) {
      headers.set(config.trustProxyHeader, clientIp)
    }
    return request(input, { ...init, headers })
  }
  return { app, db, messages, publishedObjects }
}

afterEach(() => {
  vi.useRealTimers()
  for (const db of databases.splice(0)) {
    try {
      db.close()
    } catch {
      // The closed-database case closes its connection before cleanup.
    }
  }
  vi.restoreAllMocks()
})

describe('createApp', () => {
  it('deletes the signed-in account and revokes every session', async () => {
    const { app, db, messages, publishedObjects } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const email = 'delete-me@example.com'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    const signedIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const token = signedIn.headers.get('set-auth-token')
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const secondOtp = messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0]
    const secondSignedIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp: secondOtp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const secondToken = secondSignedIn.headers.get('set-auth-token')
    const user = db.prepare('SELECT id FROM user WHERE email = ?').get(email) as
      { id: string } | undefined
    if (!user) throw new Error('Expected the signed-in user')

    const deleted = await app.request('/v1/account', {
      headers: { authorization: `Bearer ${token}`, origin },
      method: 'DELETE',
    })

    expect(deleted.status).toBe(204)
    expect(db.prepare('SELECT id FROM user WHERE id = ?').get(user.id)).toBeUndefined()
    expect(
      db.prepare('SELECT user_id FROM deleted_account WHERE user_id = ?').get(user.id),
    ).toBeDefined()
    expect(publishedObjects).toHaveLength(1)
    expect(publishedObjects[0]?.key).toBe('deleted-ids.json')
    expect(new TextDecoder().decode(publishedObjects[0]?.value)).toContain(user.id)
    expect(
      (await app.request('/v1/me', { headers: { authorization: `Bearer ${token}`, origin } }))
        .status,
    ).toBe(401)
    expect(
      (await app.request('/v1/me', { headers: { authorization: `Bearer ${secondToken}`, origin } }))
        .status,
    ).toBe(401)
    expect(
      (
        await app.request('/v1/account', {
          headers: { authorization: `Bearer ${token}`, origin },
          method: 'DELETE',
        })
      ).status,
    ).toBe(401)
  })

  it('keeps account deletion successful when deleted-id publication fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { app, db, messages } = await makeAuthApp({}, undefined, {
      put: async () => {
        throw new Error('object store unavailable')
      },
    })
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const email = 'publication-failure@example.com'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    const signedIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })

    const response = await app.request('/v1/account', {
      headers: { authorization: `Bearer ${signedIn.headers.get('set-auth-token')}`, origin },
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    expect(db.prepare('SELECT id FROM user WHERE email = ?').get(email)).toBeUndefined()
    expect(log).toHaveBeenCalledWith('Deleted account list publication failed', expect.any(Error))
  })

  it('prints sign-in mail in development and refuses to send it in production', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const message = {
      html: '<p>Your code is 482931</p>',
      subject: 'Your Lander sign-in code',
      text: 'Your Lander sign-in code is 482931.',
      to: 'person@example.com',
    }

    await createConsoleMailer('development').send(message)
    expect(log).toHaveBeenCalledWith(
      '[Lander development email] Your Lander sign-in code is 482931.',
    )
    await expect(createConsoleMailer('production').send(message)).rejects.toThrow(
      /development-only/,
    )
  })

  it('sends a fixed, short-lived reviewer code without sending email', async () => {
    const { app, messages } = await makeAuthApp({
      reviewerCode: '482931',
      reviewerEmail: 'reviewer@example.com',
    })
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'

    const send = async (email: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })

    expect((await send('reviewer@example.com')).status).toBe(200)
    expect(messages).toHaveLength(0)
    const reviewerSignIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email: 'reviewer@example.com', otp: '482931' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    expect(reviewerSignIn.status).toBe(200)
    const reviewerTokens = [reviewerSignIn.headers.get('set-auth-token')]
    for (let index = 0; index < 3; index += 1) {
      await app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email: 'reviewer@example.com', type: 'sign-in' }),
        headers: {
          'content-type': 'application/json',
          origin,
          'x-test-client-ip': `203.0.113.${10 + index}`,
        },
        method: 'POST',
      })
      const response = await app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email: 'reviewer@example.com', otp: '482931' }),
        headers: {
          'content-type': 'application/json',
          origin,
          'x-test-client-ip': `203.0.113.${10 + index}`,
        },
        method: 'POST',
      })
      expect(response.status).toBe(200)
      reviewerTokens.push(response.headers.get('set-auth-token'))
    }
    const reviewerDevices = await app.request('/v1/devices', {
      headers: { authorization: `Bearer ${reviewerTokens.at(-1)}`, origin },
    })
    expect(await reviewerDevices.json()).toMatchObject({
      devices: [{}, {}, {}],
      limit: 3,
      pending: false,
    })

    expect((await send('other@example.com')).status).toBe(200)
    const otherSignIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email: 'other@example.com', otp: '482931' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    expect(otherSignIn.status).not.toBe(200)
    expect(messages).toHaveLength(1)
  })

  it('does not accept the reviewer code when reviewer settings are unset', async () => {
    const { app, messages } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const email = 'ordinary@example.com'

    const send = await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    expect(send.status).toBe(200)
    expect(messages).toHaveLength(1)

    const signIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp: '482931' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    expect(signIn.status).not.toBe(200)
  })

  it('limits an address to five sends per hour and the service to ninety per day', async () => {
    let currentTime = new Date('2026-01-01T00:00:00.000Z')
    const { app, messages } = await makeAuthApp(
      { trustProxyHeader: 'cf-connecting-ip' },
      () => currentTime,
    )
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const send = (email: string, ip: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json', origin },
        method: 'POST',
      })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await send('person@example.com', `203.0.113.${attempt + 1}`)).status).toBe(200)
    }
    expect((await send('person@example.com', '203.0.113.6')).status).toBe(429)
    currentTime = new Date('2026-01-01T01:00:00.000Z')
    expect((await send('person@example.com', '203.0.113.7')).status).toBe(200)

    for (let attempt = 0; attempt < 84; attempt += 1) {
      expect((await send(`person-${attempt}@example.com`, `198.51.100.${attempt}`)).status).toBe(
        200,
      )
    }
    expect((await send('last@example.com', '192.0.2.1')).status).toBe(429)
    expect(messages).toHaveLength(90)
  })

  it('ignores a caller supplied client address header unless proxy trust is configured', async () => {
    const { app, messages } = await makeAuthApp({ trustProxyHeader: undefined })
    const send = (email: string, ip: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: {
          'cf-connecting-ip': ip,
          'content-type': 'application/json',
          origin: 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa',
        },
        method: 'POST',
      })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await send(`person-${attempt}@example.com`, `203.0.113.${attempt + 1}`)).status).toBe(
        200,
      )
    }
    expect((await send('fourth@example.com', '203.0.113.4')).status).toBe(429)
    expect(messages).toHaveLength(3)
  })

  it('uses each request client address when no proxy header is trusted', async () => {
    const { app, messages } = await makeAuthApp({ trustProxyHeader: undefined })
    const send = (clientIp: string) =>
      app.request(`http://${clientIp}/api/auth/email-otp/send-verification-otp`, {
        body: JSON.stringify({ email: `person-${clientIp}@example.com`, type: 'sign-in' }),
        headers: {
          'content-type': 'application/json',
          origin: 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa',
        },
        method: 'POST',
      })

    for (const clientIp of ['203.0.113.1', '203.0.113.2', '203.0.113.3', '203.0.113.4']) {
      expect((await send(clientIp)).status).toBe(200)
    }
    expect(messages).toHaveLength(4)
  })

  it('does not spend a client send limit on malformed email addresses', async () => {
    const { app } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const send = (email: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await send('not-an-email')).status).not.toBe(200)
    }
    expect((await send('valid@example.com')).status).toBe(200)
  })

  it('exempts reviewer code requests from per-email and daily email limits', async () => {
    const { app, messages } = await makeAuthApp({
      reviewerCode: '482931',
      reviewerEmail: 'reviewer@example.com',
      trustProxyHeader: 'cf-connecting-ip',
    })
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const send = (email: string, ip: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: {
          'cf-connecting-ip': ip,
          'content-type': 'application/json',
          origin,
        },
        method: 'POST',
      })

    for (let attempt = 0; attempt < 6; attempt += 1) {
      expect((await send('reviewer@example.com', `203.0.113.${attempt + 1}`)).status).toBe(200)
    }
    expect(messages).toHaveLength(0)

    for (let attempt = 0; attempt < 90; attempt += 1) {
      expect((await send(`person-${attempt}@example.com`, `198.51.100.${attempt}`)).status).toBe(
        200,
      )
    }
    expect((await send('reviewer@example.com', '192.0.2.1')).status).toBe(200)
    expect(messages).toHaveLength(90)
  })

  it('signs in with a code from a trusted extension, authenticates /v1/me, and revokes on sign-out', async () => {
    const { app, messages } = await makeAuthApp()
    const email = 'person@example.com'
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const send = await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })

    expect(send.status).toBe(200)
    expect(await send.json()).toEqual({ success: true })
    expect(messages).toHaveLength(1)
    expect(messages[0]?.to).toBe(email)
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    expect(otp).toBeDefined()

    const signIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const signedIn = (await signIn.json()) as { token: string; user: { email: string } }

    expect(signIn.status).toBe(200)
    const bearerToken = signIn.headers.get('set-auth-token')
    expect(bearerToken).toBeTruthy()
    expect(signedIn.user.email).toBe(email)

    const me = await app.request('/v1/me', {
      headers: { authorization: `Bearer ${bearerToken}`, origin },
    })
    expect(me.status).toBe(200)
    expect(await me.json()).toMatchObject({ email })

    const signOut = await app.request('/api/auth/sign-out', {
      headers: { authorization: `Bearer ${bearerToken}`, origin },
      method: 'POST',
    })
    expect(signOut.status).toBe(200)

    const afterSignOut = await app.request('/v1/me', {
      headers: { authorization: `Bearer ${bearerToken}`, origin },
    })
    expect(afterSignOut.status).toBe(401)
    expect(await afterSignOut.json()).toEqual({ error: 'signed_out' })
  })

  it('accepts an OTP just before expiry and rejects it after expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const { app, messages } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const sendCode = (email: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })
    const signIn = (email: string, otp: string | undefined) =>
      app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email, otp }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })

    const beforeExpiryEmail = 'before-expiry@example.com'
    expect((await sendCode(beforeExpiryEmail)).status).toBe(200)
    const beforeExpiryOtp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    vi.setSystemTime(new Date('2026-01-01T00:04:59.000Z'))
    expect((await signIn(beforeExpiryEmail, beforeExpiryOtp)).status).toBe(200)

    const expiredEmail = 'expired@example.com'
    expect((await sendCode(expiredEmail)).status).toBe(200)
    const expiredOtp = messages[1]?.text.match(/\b\d{6}\b/)?.[0]
    vi.setSystemTime(new Date('2026-01-01T00:10:00.000Z'))
    expect((await signIn(expiredEmail, expiredOtp)).status).not.toBe(200)
  })

  it('keeps a session until just before 60 days and expires it just after', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const { app, messages } = await makeAuthApp()
    const email = 'session-expiry@example.com'
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    const signIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const token = signIn.headers.get('set-auth-token')
    expect(signIn.status).toBe(200)
    expect(token).toBeTruthy()

    const checkSession = () =>
      app.request('/api/auth/get-session?disableRefresh=true', {
        headers: { authorization: `Bearer ${token}`, origin },
      })
    vi.setSystemTime(new Date('2026-03-01T23:59:59.000Z'))
    expect((await checkSession()).status).toBe(200)
    expect(await (await checkSession()).json()).not.toBeNull()

    vi.setSystemTime(new Date('2026-03-02T00:00:01.000Z'))
    expect(await (await checkSession()).json()).toBeNull()
  })

  it('rejects untrusted origins and accepts distinct Firefox extension origins', async () => {
    const { app, messages } = await makeAuthApp()
    const untrusted = await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email: 'untrusted@example.com', type: 'sign-in' }),
      headers: {
        'cf-connecting-ip': '203.0.113.30',
        'content-type': 'application/json',
        origin: 'chrome-extension://untrusted',
      },
      method: 'POST',
    })
    expect(untrusted.status).toBe(403)
    expect(messages).toHaveLength(0)

    for (const [index, origin] of ['moz-extension://first', 'moz-extension://second'].entries()) {
      const response = await app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email: `firefox-${index}@example.com`, type: 'sign-in' }),
        headers: {
          'cf-connecting-ip': `203.0.113.${31 + index}`,
          'content-type': 'application/json',
          origin,
        },
        method: 'POST',
      })
      expect(response.status).toBe(200)
    }
    expect(messages).toHaveLength(2)
  })

  it('accepts the bare Chrome extension origin only when the development switch is enabled', async () => {
    const { app, messages } = await makeAuthApp({
      nodeEnv: 'development',
      trustAnyExtensionOrigin: true,
    })
    const response = await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email: 'local@example.com', type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin: 'chrome-extension://local-id' },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    expect(messages).toHaveLength(1)
  })

  it('rate limits code sends per client address and does not reveal whether an address exists', async () => {
    const { app, messages } = await makeAuthApp({ trustProxyHeader: 'cf-connecting-ip' })
    const sendCode = (email: string, clientIp: string) =>
      app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: {
          'cf-connecting-ip': clientIp,
          'content-type': 'application/json',
          origin: 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa',
        },
        method: 'POST',
      })

    const known = await sendCode('person@example.com', '203.0.113.1')
    const unknown = await sendCode('nobody@example.com', '203.0.113.2')
    expect(unknown.status).toBe(known.status)
    expect(await unknown.json()).toEqual(await known.json())

    await sendCode('person@example.com', '203.0.113.10')
    await sendCode('person@example.com', '203.0.113.10')
    await sendCode('person@example.com', '203.0.113.10')
    const limited = await sendCode('person@example.com', '203.0.113.10')
    expect(limited.status).toBe(429)
    expect((await sendCode('person@example.com', '203.0.113.11')).status).toBe(200)
    expect(messages).toHaveLength(6)
  })

  it('stores only a hashed verification code and does not store the client address on sessions', async () => {
    const { app, db, messages } = await makeAuthApp()
    const email = 'person@example.com'
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'cf-connecting-ip': '203.0.113.20', 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    expect(otp).toBeDefined()
    const verification = db.prepare('SELECT value FROM verification').get() as
      { value: string } | undefined
    expect(verification?.value).toBeDefined()
    expect(verification?.value).not.toContain(otp)

    await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const session = db.prepare('SELECT ipAddress FROM session').get() as
      { ipAddress: string | null } | undefined
    expect(session?.ipAddress).toBeNull()
  })

  it('rejects a verification code after three failed attempts', async () => {
    const { app, messages } = await makeAuthApp()
    const email = 'person@example.com'
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email, type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    expect(otp).toBeDefined()

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const invalid = await app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email, otp: otp === '000000' ? '000001' : '000000' }),
        headers: {
          'cf-connecting-ip': `203.0.113.${40 + attempt}`,
          'content-type': 'application/json',
          origin,
        },
        method: 'POST',
      })
      expect(invalid.status).toBe(400)
    }

    const locked = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    expect(locked.status).not.toBe(200)
  })

  it('reports a healthy database and returns JSON', async () => {
    const app = await makeApp()
    const response = await app.request('/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('syncs only the signed-in account and supports revision validators', async () => {
    const { app, messages } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const signIn = async (email: string) => {
      await app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })
      const otp = messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0]
      const response = await app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email, otp }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })
      return response.headers.get('set-auth-token')
    }
    const firstToken = await signIn('first@example.com')
    const secondToken = await signIn('second@example.com')
    const request = (token: string | null, path: string, init: RequestInit = {}) =>
      app.request(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          origin,
        },
      })

    expect((await request(null, '/v1/sync')).status).toBe(401)
    const saved = await request(firstToken, '/v1/sync/layout', {
      body: JSON.stringify({ value: { v: 1, widgets: [{ type: 'future-widget' }] } }),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toEqual({ changed: true, rev: 1 })

    const firstSnapshot = await request(firstToken, '/v1/sync')
    expect(firstSnapshot.status).toBe(200)
    expect(firstSnapshot.headers.get('cache-control')).toBe('no-store')
    expect(firstSnapshot.headers.get('etag')).toBe('"1"')
    expect(await firstSnapshot.json()).toMatchObject({
      items: { layout: { v: 1, value: { v: 1, widgets: [{ type: 'future-widget' }] } } },
      rev: 1,
    })
    const notModified = await request(firstToken, '/v1/sync', {
      headers: { 'if-none-match': '"1"' },
    })
    expect(notModified.status).toBe(304)
    expect(notModified.headers.get('cache-control')).toBe('no-store')

    const otherSnapshot = await request(secondToken, '/v1/sync')
    expect(await otherSnapshot.json()).toEqual({ items: {}, rev: 0 })
    const unknown = await request(firstToken, '/v1/sync/made-up', {
      body: JSON.stringify({ value: {} }),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    })
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: 'unknown_item' })
  })

  it('marks a fourth sign-in pending and blocks its sync routes until a device is removed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const { app, messages } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const signIn = async (index: number) => {
      const email = 'device-limit@example.com'
      const host = `http://198.51.100.${index + 1}`
      await app.request(`${host}/api/auth/email-otp/send-verification-otp`, {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: {
          'content-type': 'application/json',
          origin,
          'x-test-client-ip': `198.51.100.${index + 1}`,
        },
        method: 'POST',
      })
      const otp = messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0]
      const response = await app.request(`${host}/api/auth/sign-in/email-otp`, {
        body: JSON.stringify({ email, otp }),
        headers: {
          'content-type': 'application/json',
          origin,
          'x-test-client-ip': `198.51.100.${index + 1}`,
        },
        method: 'POST',
      })
      return response.headers.get('set-auth-token')
    }
    const tokens: (string | null)[] = []
    for (let index = 0; index < 4; index += 1) tokens.push(await signIn(index))
    const request = (token: string | null, path: string, method = 'GET') =>
      app.request(path, { headers: { authorization: `Bearer ${token}`, origin }, method })

    const me = await request(tokens[3] ?? null, '/v1/me')
    expect(await me.json()).toMatchObject({ limit: 3, pending: true })
    expect((await request(tokens[3] ?? null, '/v1/sync')).status).toBe(403)
    expect((await request(tokens[3] ?? null, '/v1/devices')).status).toBe(200)
    expect((await request(tokens[3] ?? null, '/api/auth/get-session')).status).toBe(403)

    const deviceList = (await (await request(tokens[3] ?? null, '/v1/devices')).json()) as {
      devices: { current: boolean; id: string }[]
    }
    const removable = deviceList.devices.find((device) => !device.current)
    expect(removable).toBeDefined()
    expect(Object.keys(deviceList.devices[0] ?? {}).sort()).toEqual([
      'browser',
      'createdAt',
      'current',
      'id',
      'lastUsedAt',
      'os',
    ])
    expect(
      (await request(tokens[3] ?? null, `/v1/devices/${removable?.id}`, 'DELETE')).status,
    ).toBe(204)
    expect(await (await request(tokens[3] ?? null, '/v1/me')).json()).toMatchObject({
      pending: false,
    })
    expect((await request(tokens[3] ?? null, '/v1/sync')).status).toBe(200)

    expect(
      (
        await app.request('/api/auth/sign-out', {
          headers: { authorization: `Bearer ${tokens[3]}`, origin },
          method: 'POST',
        })
      ).status,
    ).toBe(200)
  })

  it('limits sync writes to sixty per session each minute', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z')
    const { app, messages } = await makeAuthApp({}, () => now)
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email: 'write-limit@example.com', type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    const signedIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email: 'write-limit@example.com', otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const token = signedIn.headers.get('set-auth-token')
    const put = () =>
      app.request('/v1/sync/onboarding', {
        body: JSON.stringify({ value: { dismissed: [], welcomed: false } }),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          origin,
        },
        method: 'PUT',
      })

    for (let attempt = 0; attempt < 60; attempt += 1) expect((await put()).status).toBe(200)
    expect(await (await put()).json()).toEqual({ error: 'rate_limited' })
    now = new Date(now.getTime() + 60_000)
    expect((await put()).status).toBe(200)
  })

  it('keeps separate write limits for two sessions on one account', async () => {
    const { app, messages } = await makeAuthApp()
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    const signIn = async () => {
      await app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email: 'multi-session@example.com', type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })
      const otp = messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0]
      const response = await app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email: 'multi-session@example.com', otp }),
        headers: { 'content-type': 'application/json', origin },
        method: 'POST',
      })
      return response.headers.get('set-auth-token')
    }
    const firstToken = await signIn()
    const secondToken = await signIn()
    const put = (token: string | null) =>
      app.request('/v1/sync/onboarding', {
        body: JSON.stringify({ value: { dismissed: [], welcomed: false } }),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          origin,
        },
        method: 'PUT',
      })

    for (let attempt = 0; attempt < 59; attempt += 1)
      expect((await put(firstToken)).status).toBe(200)
    expect((await put(secondToken)).status).toBe(200)
    expect((await put(secondToken)).status).toBe(200)
  })

  it('records account activity for authenticated requests', async () => {
    const now = new Date('2026-01-01T12:00:00.000Z')
    const { app, db, messages } = await makeAuthApp({}, () => now)
    const origin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
    await app.request('/api/auth/email-otp/send-verification-otp', {
      body: JSON.stringify({ email: 'activity@example.com', type: 'sign-in' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const otp = messages[0]?.text.match(/\b\d{6}\b/)?.[0]
    const signedIn = await app.request('/api/auth/sign-in/email-otp', {
      body: JSON.stringify({ email: 'activity@example.com', otp }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    })
    const token = signedIn.headers.get('set-auth-token')
    await app.request('/v1/sync', { headers: { authorization: `Bearer ${token}`, origin } })
    const user = db.prepare('SELECT id FROM user WHERE email = ?').get('activity@example.com') as
      { id: string } | undefined
    if (!user) throw new Error('Expected the authenticated user to exist')
    const account = db
      .prepare('SELECT last_used_at FROM settings_account WHERE user_id = ?')
      .get(user.id) as { last_used_at: number | null } | undefined

    expect(account?.last_used_at).toBe(now.getTime())
  })

  it('reports an unavailable database as 503', async () => {
    const app = await makeApp()
    databases.at(-1)?.close()

    const response = await app.request('/health')

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'unavailable' })
  })

  it('answers extension preflight requests and adds CORS headers to plain responses', async () => {
    const app = await makeApp()
    const preflight = await app.request('/health', {
      headers: {
        'Access-Control-Request-Headers': 'authorization,content-type',
        'Access-Control-Request-Method': 'GET',
        Origin: 'chrome-extension://example',
      },
      method: 'OPTIONS',
    })

    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull()
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization')
    expect(preflight.headers.get('access-control-allow-headers')).toContain('if-none-match')
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,PUT,DELETE,OPTIONS',
    )
    expect(preflight.headers.get('access-control-max-age')).toBe('600')
    expect(preflight.headers.get('access-control-expose-headers')).toContain('set-auth-token')
    expect(preflight.headers.get('access-control-expose-headers')).toContain('etag')

    const response = await app.request('/health')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('refuses a request body larger than 16 KiB with a JSON error', async () => {
    const app = await makeApp()
    const response = await app.request('/health', {
      body: JSON.stringify({ value: 'x'.repeat(17 * 1024) }),
      headers: { 'content-length': String(17 * 1024), 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ error: 'too_large' })
  })

  it('stops reading a streamed body without Content-Length at the limit', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController
        streamController.enqueue(new Uint8Array(17 * 1024))
      },
    })
    const request = new Request('http://localhost/health', {
      body,
      duplex: 'half',
      headers: { 'content-type': 'application/octet-stream' },
      method: 'POST',
    } as RequestInit & { duplex: 'half' })

    try {
      const response = await Promise.race([
        makeApp().then((app) => app.request(request)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
      ])

      expect(response).not.toBeNull()
      expect(response?.status).toBe(413)
    } finally {
      controller?.close()
    }
  })

  it('logs request metadata without logging personal data or credentials', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const app = await makeApp()

    await app.request('/health?email=private@example.com&code=482931', {
      headers: {
        Authorization: 'Bearer secret-token',
        'X-Forwarded-For': '203.0.113.10',
      },
    })

    expect(log).toHaveBeenCalledOnce()
    const line = String(log.mock.calls[0]?.[0])
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(['durationMs', 'route', 'status'])
    expect(line).toContain('/health')
    expect(line).toContain('200')
    expect(line).not.toContain('private@example.com')
    expect(line).not.toContain('482931')
    expect(line).not.toContain('secret-token')
    expect(line).not.toContain('203.0.113.10')
    expect(line).toMatch(/"durationMs":\d+/)
  })

  it('logs the matched route instead of an unmatched request path', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const app = await makeApp()
    const response = await app.request('/private@example.com')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
    const line = String(log.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toMatchObject({ route: '/*', status: 404 })
    expect(line).not.toContain('private@example.com')
  })

  it('returns a sanitized JSON error for an unhandled route error', async () => {
    const app = await makeApp()
    app.get('/crash', () => {
      throw new Error('private@example.com')
    })

    const response = await app.request('/crash')

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ error: 'internal_error' })
  })
})
