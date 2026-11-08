import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

import { createAuth, type Mailer } from './auth.js'
import type { ServerConfig } from './config.js'

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
  objectStore: {
    get: (key: string) => Promise<Uint8Array | undefined>
    put: (key: string, value: Uint8Array) => Promise<void>
  }
}

export async function createApp(dependencies: AppDependencies) {
  const auth = await createAuth(dependencies)
  const { db } = dependencies
  const app = new Hono()
  const emailSends = new Map<string, number[]>()
  const dailySends = new Map<number, number>()
  const ipSends = new Map<string, number[]>()

  app.use(
    '*',
    cors({
      allowHeaders: ['authorization', 'content-type'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['set-auth-token'],
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

  app.notFound((context) => context.json({ error: 'not_found' }, 404))
  app.onError((_error, context) => {
    return context.json({ error: 'internal_error' }, 500)
  })

  return app
}
