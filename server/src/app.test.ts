import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'

const databases: DatabaseSync[] = []

function makeApp() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  return createApp({
    clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
    config: { authSecret: 'a'.repeat(32), nodeEnv: 'test' },
    db,
    mailer: { send: async () => undefined },
    objectStore: { get: async () => undefined, put: async () => undefined },
  })
}

afterEach(() => {
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
  it('reports a healthy database and returns JSON', async () => {
    const response = await makeApp().request('/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('reports an unavailable database as 503', async () => {
    const app = makeApp()
    databases.at(-1)?.close()

    const response = await app.request('/health')

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'unavailable' })
  })

  it('answers extension preflight requests and adds CORS headers to plain responses', async () => {
    const app = makeApp()
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
    expect(preflight.headers.get('access-control-allow-methods')).toContain('DELETE')
    expect(preflight.headers.get('access-control-max-age')).toBe('600')
    expect(preflight.headers.get('access-control-expose-headers')).toBe('set-auth-token')

    const response = await app.request('/health')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('refuses a request body larger than 16 KiB with a JSON error', async () => {
    const response = await makeApp().request('/health', {
      body: JSON.stringify({ value: 'x'.repeat(17 * 1024) }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ error: 'too_large' })
  })

  it('logs request metadata without logging personal data or credentials', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const app = makeApp()

    await app.request('/health?email=private@example.com&code=482931', {
      headers: {
        Authorization: 'Bearer secret-token',
        'X-Forwarded-For': '203.0.113.10',
      },
    })

    expect(log).toHaveBeenCalledOnce()
    const line = String(log.mock.calls[0]?.[0])
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(['durationMs', 'path', 'status'])
    expect(line).toContain('/health')
    expect(line).toContain('200')
    expect(line).not.toContain('private@example.com')
    expect(line).not.toContain('482931')
    expect(line).not.toContain('secret-token')
    expect(line).not.toContain('203.0.113.10')
    expect(line).toMatch(/"durationMs":\d+/)
  })
})
