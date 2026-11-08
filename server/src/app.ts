import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { DatabaseSync } from 'node:sqlite'

import { createAuth, type Mailer } from './auth.js'
import type { ServerConfig } from './config.js'
import type { ObjectStore } from './objectStore.js'

const maximumBodyBytes = 16 * 1024

export type AppDependencies = {
  clock: { now: () => Date }
  config: ServerConfig
  db: DatabaseSync
  mailer: Mailer
  objectStore: ObjectStore
}

export async function createApp(dependencies: AppDependencies) {
  const auth = await createAuth(dependencies)
  const { db } = dependencies
  const app = new Hono()

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
