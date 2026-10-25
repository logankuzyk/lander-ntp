import { serve } from '@hono/node-server'
import { pathToFileURL } from 'node:url'

import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { openDatabase } from './database.js'

export function startServer() {
  const config = loadConfig()
  const db = openDatabase(config.databasePath)
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
  const server = serve({ fetch: app.fetch, port: config.port })

  process.once('SIGTERM', () => {
    server.close(() => {
      db.close()
    })
  })

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
