import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { createApp } from '../server/src/app.js'
import type { ServerConfig } from '../server/src/config.js'
import type { ObjectStore } from '../server/src/objectStore.js'
import { exampleLayout } from '../src/layout/fixtures.js'
import type { StoredLayout } from '../src/layout/types.js'
import { planFirstSignIn } from '../src/sync/planning.js'

type SyncItem = { v: number; value: unknown }

type Device = {
  account: { email: string; token: string } | null
  browserStorage: Map<string, unknown>
  get: (path: string) => Promise<Response>
  name: string
  put: (item: string, value: unknown) => Promise<Response>
  signIn: (email: string) => Promise<void>
}

const databases: DatabaseSync[] = []
const extensionOrigin = 'chrome-extension://ocglhjclnhfbgbccffinhioaangigioa'
const layoutValue = (type: 'clock' | 'weather' = 'clock'): StoredLayout => {
  const layout = exampleLayout()
  return { ...layout, widgets: layout.widgets.filter((widget) => widget.type === type) }
}

async function makeServer(options: { reviewer?: boolean } = {}) {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const mail: string[] = []
  const config: ServerConfig = {
    authSecret: 'a'.repeat(32),
    databasePath: ':memory:',
    nodeEnv: 'test',
    port: 3000,
    trustAnyExtensionOrigin: false,
    trustedExtensionIds: ['ocglhjclnhfbgbccffinhioaangigioa'],
    trustProxyHeader: 'x-test-client-ip',
    ...(options.reviewer ? { reviewerCode: '246810', reviewerEmail: 'reviewer@example.com' } : {}),
  }
  const objectStore: ObjectStore = {
    delete: async () => undefined,
    get: async () => undefined,
    list: async () => [],
    put: async () => undefined,
  }
  const app = await createApp({
    clock: { now: () => new Date() },
    config,
    db,
    getClientAddress: () => '127.0.0.1',
    mailer: {
      send: async (message) => {
        mail.push(message.text)
      },
    },
    objectStore,
  })
  return { app, mail }
}

function makeDevice(
  app: Awaited<ReturnType<typeof makeServer>>['app'],
  mail: string[],
  name: string,
  serverIsUp: () => boolean = () => true,
): Device {
  const browserStorage = new Map<string, unknown>()
  const clientIp = `192.0.2.${([...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 250) + 1}`
  const callServer = (path: string, token?: string, init?: RequestInit) =>
    serverIsUp()
      ? request(app, path, token, init)
      : Promise.reject(new TypeError('The server is unavailable'))
  const device: Device = {
    account: null,
    browserStorage,
    get: (path) => callServer(path, device.account?.token),
    name,
    put: (item, value) =>
      callServer(`/v1/sync/${item}`, device.account?.token, {
        body: JSON.stringify({ value }),
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
      }),
    signIn: async (email) => {
      const sent = await app.request('/api/auth/email-otp/send-verification-otp', {
        body: JSON.stringify({ email, type: 'sign-in' }),
        headers: {
          'content-type': 'application/json',
          origin: extensionOrigin,
          'x-test-client-ip': clientIp,
        },
        method: 'POST',
      })
      expect(sent.status).toBe(200)
      const code =
        email === 'reviewer@example.com' ? '246810' : mail.at(-1)?.match(/\b\d{6}\b/)?.[0]
      const response = await app.request('/api/auth/sign-in/email-otp', {
        body: JSON.stringify({ email, otp: code }),
        headers: {
          'content-type': 'application/json',
          origin: extensionOrigin,
          'x-test-client-ip': clientIp,
        },
        method: 'POST',
      })
      const data = (await response.json()) as { token?: string }
      expect(response.status).toBe(200)
      expect(data.token).toBeTypeOf('string')
      device.account = { email, token: data.token! }
    },
  }
  return device
}

function request(
  app: Awaited<ReturnType<typeof makeServer>>['app'],
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('origin', extensionOrigin)
  if (token) headers.set('authorization', `Bearer ${token}`)
  return Promise.resolve(app.request(path, { ...init, headers }))
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

describe('two devices against the server app', () => {
  it('keeps account sync shared while each device keeps its own browser storage', async () => {
    const { app, mail } = await makeServer()
    const first = makeDevice(app, mail, 'first')
    const second = makeDevice(app, mail, 'second')
    const email = 'person@example.com'

    await first.signIn(email)
    await second.signIn(email)

    const storedLayoutValue = layoutValue()
    const saved = { layout: { v: 1, value: storedLayoutValue } }
    first.browserStorage.set('layout', saved.layout)
    expect((await first.put('layout', storedLayoutValue)).status).toBe(200)
    const snapshot = (await (await second.get('/v1/sync')).json()) as {
      items: Record<string, SyncItem>
    }
    const layout = snapshot.items.layout
    expect(layout).toBeDefined()
    second.browserStorage.set('layout', { v: layout!.v, value: layout!.value })

    expect(second.browserStorage.get('layout')).toEqual(saved.layout)
    expect(first.browserStorage).not.toBe(second.browserStorage)
    expect(snapshot.items.layout).toEqual({ v: 1, value: storedLayoutValue })

    const unchanged = await second.put('layout', storedLayoutValue)
    expect(await unchanged.json()).toEqual({ changed: false, rev: 1 })

    const later = layoutValue('weather')
    expect(await (await second.put('layout', later)).json()).toEqual({ changed: true, rev: 2 })
    const latest = (await (await first.get('/v1/sync')).json()) as {
      items: Record<string, SyncItem>
    }
    expect(latest.items.layout).toEqual({ v: 1, value: later })
  })

  it.each([
    { local: {}, remote: {}, result: 'nothing', when: 'neither side is arranged' },
    {
      local: { layout: { v: 1, value: layoutValue() } },
      remote: {},
      result: 'upload',
      when: 'only this browser has a Layout',
    },
    {
      local: {},
      remote: { layout: { v: 1, value: layoutValue() } },
      result: 'download',
      when: 'only the account has a Layout',
    },
    {
      local: { settings: { ...settingsValue(), dim: true } },
      remote: { settings: settingsValue() },
      result: 'ask',
      when: 'both sides are arranged differently',
    },
    {
      local: { settings: settingsValue() },
      remote: { settings: settingsValue() },
      result: 'nothing',
      when: 'both sides have the same settings',
    },
  ])('chooses first sign-in behavior when $when', ({ local, remote, result }) => {
    expect(planFirstSignIn(local, remote)).toBe(result)
  })

  it('admits a fourth device after the picker frees a place', async () => {
    const { app, mail } = await makeServer()
    const devices = ['first', 'second', 'third', 'fourth'].map((name) =>
      makeDevice(app, mail, name),
    )
    for (const device of devices) await device.signIn('person@example.com')

    const pending = await (await devices[3]!.get('/v1/me')).json()
    expect(pending).toMatchObject({ limit: 3, pending: true })
    const firstDevice = (await (await devices[0]!.get('/v1/me')).json()) as { deviceId: string }
    const list = (await (await devices[3]!.get('/v1/devices')).json()) as {
      devices: { current: boolean; id: string }[]
    }
    expect(list.devices.some(({ id }) => id === firstDevice.deviceId)).toBe(true)
    expect(
      (
        await request(app, `/v1/devices/${firstDevice.deviceId}`, devices[3]!.account?.token, {
          method: 'DELETE',
        })
      ).status,
    ).toBe(204)
    expect((await devices[0]!.get('/v1/me')).status).toBe(401)
    expect(await (await devices[3]!.get('/v1/me')).json()).toMatchObject({ pending: false })
  })

  it('revokes every device on account deletion while keeping each local page', async () => {
    const { app, mail } = await makeServer()
    const first = makeDevice(app, mail, 'first')
    const second = makeDevice(app, mail, 'second')
    await first.signIn('person@example.com')
    await second.signIn('person@example.com')
    const clockLayout = layoutValue()
    const weatherLayout = layoutValue('weather')
    first.browserStorage.set('layout', { v: 1, value: clockLayout })
    second.browserStorage.set('layout', { v: 1, value: weatherLayout })

    expect(
      (await request(app, '/v1/account', first.account?.token, { method: 'DELETE' })).status,
    ).toBe(204)
    expect((await first.get('/v1/sync')).status).toBe(401)
    expect((await second.get('/v1/sync')).status).toBe(401)
    expect(first.browserStorage.get('layout')).toEqual({ v: 1, value: clockLayout })
    expect(second.browserStorage.get('layout')).toEqual({ v: 1, value: weatherLayout })
  })

  it('keeps a device local page while the server is down and resumes sync when it returns', async () => {
    const { app, mail } = await makeServer()
    let serverIsUp = true
    const device = makeDevice(app, mail, 'returning', () => serverIsUp)
    await device.signIn('person@example.com')
    const layout = { v: 1, value: layoutValue() }
    device.browserStorage.set('layout', layout)

    serverIsUp = false
    await expect(device.put('layout', layout.value)).rejects.toThrow('The server is unavailable')
    expect(device.browserStorage.get('layout')).toEqual(layout)

    serverIsUp = true
    expect((await device.put('layout', layout.value)).status).toBe(200)
    const snapshot = (await (await device.get('/v1/sync')).json()) as {
      items: Record<string, SyncItem>
    }
    expect(snapshot.items.layout).toEqual({ v: 1, value: layout.value })
  })

  it('refuses oversized and lower-version Layout writes and admits the reviewer sign-in', async () => {
    const { app, mail } = await makeServer({ reviewer: true })
    const device = makeDevice(app, mail, 'reviewer')
    await device.signIn('reviewer@example.com')

    expect((await device.put('layout', layoutValue())).status).toBe(200)
    const newerLayout = { ...layoutValue(), v: 2 as const }
    expect((await device.put('layout', newerLayout)).status).toBe(200)
    expect((await device.put('layout', layoutValue())).status).toBe(409)
    let payloadLength = 0
    let boundaryValue = { ...newerLayout, padding: 'x'.repeat(payloadLength) }
    while (new TextEncoder().encode(`layout${JSON.stringify(boundaryValue)}`).length < 8192) {
      payloadLength += 1
      boundaryValue = { ...newerLayout, padding: 'x'.repeat(payloadLength) }
    }
    expect(new TextEncoder().encode(`layout${JSON.stringify(boundaryValue)}`).length).toBe(8192)
    expect((await device.put('layout', boundaryValue)).status).toBe(200)
    expect(
      (await device.put('layout', { ...newerLayout, padding: 'x'.repeat(payloadLength + 1) }))
        .status,
    ).toBe(413)
    expect((await device.get('/v1/me')).status).toBe(200)
  })
})

function settingsValue() {
  return {
    clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
    dim: false,
    font: 'geist-sans',
    photos: { frequency: 'daily', mode: 'cycle', pinnedId: null, tags: [] },
    v: 1,
    weather: {
      enabled: false,
      fields: [
        { id: 'temperature', shown: true },
        { id: 'condition', shown: true },
        { id: 'wind', shown: true },
      ],
      followDevice: false,
      place: null,
      unit: 'celsius',
    },
  }
}
