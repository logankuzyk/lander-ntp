import { serve } from '@hono/node-server'
import { type Server as HttpServer } from 'node:http'
import { type DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

import { createApp } from './app.js'
import { loadConfig, type ServerConfig } from './config.js'
import { openDatabase } from './database.js'

export type StartServerOptions = {
  config?: ServerConfig
  db?: DatabaseSync
  shutdownTimeoutMs?: number
}

export function startServer(options: StartServerOptions = {}) {
  const config = options.config ?? loadConfig()
  const db = options.db ?? openDatabase(config.databasePath)
  const app = createApp({
    clock: { now: () => new Date() },
    config,
    db,
    mailer: {
      send: async () => {
        throw new Error('Mailer is not configured')
      },
    },
    objectStore: {
      get: async () => {
        throw new Error('Object store is not configured')
      },
      put: async () => {
        throw new Error('Object store is not configured')
      },
    },
  })
  const server = serve({ fetch: app.fetch, port: config.port }) as HttpServer

  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true

    const shutdownTimer = setTimeout(
      () => server.closeAllConnections(),
      options.shutdownTimeoutMs ?? 10_000,
    )
    shutdownTimer.unref()
    server.close(() => {
      clearTimeout(shutdownTimer)
      process.removeListener('SIGTERM', shutdown)
      process.removeListener('SIGINT', shutdown)
      if (db.isOpen) db.close()
    })
    server.closeIdleConnections()
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    startServer()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error'
    console.error(`Server failed to start: ${message}`)
    process.exitCode = 1
  }
}
