import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

import { createAuth, type Mailer } from './auth.js'
import type { ServerConfig } from './config.js'
import type { ObjectStore } from './objectStore.js'
import { SettingsStore } from './settingsStore.js'
import { pruneExpiredSyncWrites } from './syncWriteLimit.js'

const maximumBodyBytes = 16 * 1024
const emailWindowMs = 60 * 60 * 1000
const dailyWindowMs = 24 * 60 * 60 * 1000
const ipWindowMs = 60 * 1000
const emailSendLimit = 5
const dailySendLimit = 90
const ipSendLimit = 3

export type AppDependencies = {
  clock: { now: () => Date }
  config: ServerConfig
  db: DatabaseSync
  getClientAddress: (context: Context) => string | undefined
  mailer: Mailer
  objectStore: ObjectStore
}

export async function createApp(dependencies: AppDependencies) {
  const auth = await createAuth(dependencies)
  const { db } = dependencies
  const app = new Hono<{ Variables: { sessionId: string; userId: string } }>()
  const settings = new SettingsStore(db, dependencies.clock)
  const syncWrites = new Map<string, number[]>()
  const emailSends = new Map<string, number[]>()
  const dailySends = new Map<number, number>()
  const ipSends = new Map<string, number[]>()

  app.use(
    '*',
    cors({
      allowHeaders: ['authorization', 'content-type', 'if-none-match'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['etag', 'set-auth-token'],
      maxAge: 600,
      origin: '*',
    }),
  )

  app.use('/api/auth/email-otp/send-verification-otp', async (context, next) => {
    let body: unknown
    try {
      body = await context.req.raw.clone().json()
    } catch {
      await next()
      return
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('email' in body) ||
      typeof body.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
    ) {
      await next()
      return
    }

    const email = body.email.trim().toLowerCase()
    const now = dependencies.clock.now().getTime()
    const trustedProxyAddress = dependencies.config.trustProxyHeader
      ? context.req.header(dependencies.config.trustProxyHeader)?.trim()
      : undefined
    const ip = trustedProxyAddress || dependencies.getClientAddress(context) || 'unknown'
    for (const [address, sentAt] of ipSends) {
      const activeSends = sentAt.filter((time) => now - time < ipWindowMs)
      if (activeSends.length === 0) {
        ipSends.delete(address)
      } else {
        ipSends.set(address, activeSends)
      }
    }
    const recentIpSends = ipSends.get(ip) ?? []
    if (recentIpSends.length >= ipSendLimit) return context.json({ error: 'rate_limited' }, 429)
    recentIpSends.push(now)
    ipSends.set(ip, recentIpSends)

    if (email === dependencies.config.reviewerEmail && dependencies.config.reviewerCode) {
      await next()
      return
    }

    const currentDay = Math.floor(now / dailyWindowMs)
    for (const [address, sentAt] of emailSends) {
      const activeSends = sentAt.filter((time) => now - time < emailWindowMs)
      if (activeSends.length === 0) {
        emailSends.delete(address)
      } else {
        emailSends.set(address, activeSends)
      }
    }
    for (const day of dailySends.keys()) {
      if (day < currentDay) dailySends.delete(day)
    }
    const recentSends = emailSends.get(email) ?? []
    if (
      recentSends.length >= emailSendLimit ||
      (dailySends.get(currentDay) ?? 0) >= dailySendLimit
    ) {
      return context.json({ error: 'rate_limited' }, 429)
    }

    recentSends.push(now)
    emailSends.set(email, recentSends)
    dailySends.set(currentDay, (dailySends.get(currentDay) ?? 0) + 1)
    await next()
  })

  app.use('*', async (context, next) => {
    const startedAt = performance.now()
    await next()
    console.info(
      JSON.stringify({
        durationMs: Math.round(performance.now() - startedAt),
        route: context.req.routePath ?? '/*',
        status: context.res.status,
      }),
    )
  })

  app.use(
    '*',
    bodyLimit({
      maxSize: maximumBodyBytes,
      onError: (context) => context.json({ error: 'too_large' }, 413),
    }),
  )

  app.get('/health', (context) => {
    try {
      db.prepare('SELECT 1').get()
      return context.json({ ok: true })
    } catch {
      return context.json({ error: 'unavailable' }, 503)
    }
  })

  app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw))

  app.use('/v1/*', async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers })
    if (!session) return context.json({ error: 'signed_out' }, 401)
    context.set('userId', session.user.id)
    context.set('sessionId', session.session.id)
    settings.touch(session.user.id, dependencies.clock.now())
    await next()
  })

  app.get('/v1/me', async (context) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers })
    if (!session) return context.json({ error: 'signed_out' }, 401)
    return context.json({
      deviceId: session.session.id,
      email: session.user.email,
      limit: 3,
      pending: false,
    })
  })

  app.get('/v1/sync', (context) => {
    const snapshot = settings.get(context.get('userId'))
    const etag = `"${snapshot.rev}"`
    context.header('Cache-Control', 'no-store')
    context.header('ETag', etag)
    if (context.req.header('If-None-Match') === etag) return context.body(null, 304)
    return context.json(snapshot)
  })

  app.put('/v1/sync/:item', async (context) => {
    const now = dependencies.clock.now().getTime()
    const sessionId = context.get('sessionId')
    pruneExpiredSyncWrites(syncWrites, now)
    const writes = syncWrites.get(sessionId) ?? []
    if (writes.length >= 60) return context.json({ error: 'rate_limited' }, 429)
    writes.push(now)
    syncWrites.set(sessionId, writes)

    let body: unknown
    try {
      body = await context.req.json()
    } catch {
      return context.json({ error: 'invalid' }, 422)
    }
    if (typeof body !== 'object' || body === null || !('value' in body)) {
      return context.json({ error: 'invalid' }, 422)
    }
    const result = settings.put(context.get('userId'), context.req.param('item'), body.value)
    if (result === 'unknown_item') return context.json({ error: result }, 404)
    if (result === 'too_large') return context.json({ error: result }, 413)
    if (result === 'invalid') return context.json({ error: result }, 422)
    if (result === 'older_version') {
      const storedV = settings.get(context.get('userId')).items[
        context.req.param('item') as 'layout' | 'onboarding' | 'settings'
      ]?.v
      return context.json({ error: result, storedV }, 409)
    }
    return context.json({ changed: result.changed, rev: result.rev })
  })

  app.notFound((context) => context.json({ error: 'not_found' }, 404))
  app.onError((_error, context) => {
    return context.json({ error: 'internal_error' }, 500)
  })

  return app
}
