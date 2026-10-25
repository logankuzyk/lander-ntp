import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { ServerConfig } from './config.js'

const maximumBodyBytes = 16 * 1024

export type AppDependencies = {
  clock: { now: () => Date }
  config: Pick<ServerConfig, 'authSecret' | 'nodeEnv'>
  db: { prepare: (query: string) => { get: () => unknown } }
  mailer: { send: (message: unknown) => Promise<void> }
  objectStore: {
    get: (key: string) => Promise<Uint8Array | undefined>
    put: (key: string, value: Uint8Array) => Promise<void>
  }
}

export function createApp({ db }: AppDependencies) {
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
        path: context.req.path,
        status: context.res.status,
      }),
    )
  })

  app.use('*', async (context, next) => {
    const contentLength = Number(context.req.header('content-length') ?? 0)
    const actualLength = await context.req.raw
      .clone()
      .arrayBuffer()
      .then((body) => body.byteLength)
    if (contentLength > maximumBodyBytes || actualLength > maximumBodyBytes) {
      return context.json({ error: 'too_large' }, 413)
    }
    await next()
  })

  app.get('/health', (context) => {
    try {
      db.prepare('SELECT 1').get()
      return context.json({ ok: true })
    } catch {
      return context.json({ error: 'unavailable' }, 503)
    }
  })

  app.notFound((context) => context.json({ error: 'not_found' }, 404))
  app.onError((_error, context) => {
    return context.json({ error: 'internal_error' }, 500)
  })

  return app
}
