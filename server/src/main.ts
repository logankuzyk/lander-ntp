import { serve } from '@hono/node-server'
import { type Server as HttpServer } from 'node:http'
import { type DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

import { createApp } from './app.js'
import { createConsoleMailer } from './auth.js'
import { Backups } from './backups.js'
import { loadConfig, type ServerConfig } from './config.js'
import { openDatabase } from './database.js'
import { pingHeartbeat } from './heartbeat.js'
import { createDirectoryObjectStore, createR2ObjectStore, type ObjectStore } from './objectStore.js'

export type StartServerOptions = {
  config?: ServerConfig
  db?: DatabaseSync
  objectStore?: ObjectStore
  shutdownTimeoutMs?: number
}

function makeObjectStore(config: ServerConfig): ObjectStore {
  return config.r2
    ? createR2ObjectStore(config.r2)
    : createDirectoryObjectStore(config.objectStoreDirectory ?? 'data/objects')
}

function nextNightlyTime(now: Date): Date {
  const next = new Date(now)
  next.setUTCHours(3, 17, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

export function scheduleNightlyBackup(backups: Backups, clock: { now: () => Date }): () => void {
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  const schedule = () => {
    if (stopped) return
    const now = clock.now()
    const delay = nextNightlyTime(now).getTime() - now.getTime()
    timer = setTimeout(() => {
      void backups.runNightly().catch(() => undefined).finally(schedule)
    }, delay)
    timer.unref()
  }
  schedule()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

export function startBackupMaintenance(backups: Backups, clock: { now: () => Date }) {
  const startup = backups
    .ensureRecentDump()
    .catch((error: unknown) => console.error('Startup database dump failed', error))
  const stop = scheduleNightlyBackup(backups, clock)
  return { startup, stop }
}

export async function startServer(options: StartServerOptions = {}) {
  const config = options.config ?? loadConfig()
  const db = options.db ?? openDatabase(config.databasePath)
  const clock = { now: () => new Date() }
  const objectStore = options.objectStore ?? makeObjectStore(config)
  const backups = new Backups({
    clock,
    databasePath: config.databasePath,
    db,
    ...(config.heartbeatUrl
      ? {
          heartbeat: async (signal: AbortSignal) => {
            await pingHeartbeat(config.heartbeatUrl!, signal)
          },
        }
      : {}),
    objectStore,
  })
  const app = await createApp({
    clock,
    config,
    db,
    mailer: createConsoleMailer(config.nodeEnv),
    objectStore,
  })
  let stopBackupSchedule: () => void = () => undefined
  if (config.nodeEnv !== 'test') {
    const maintenance = startBackupMaintenance(backups, clock)
    stopBackupSchedule = maintenance.stop
  }
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
      stopBackupSchedule()
    })
    server.closeIdleConnections()
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await startServer()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error'
    console.error(`Server failed to start: ${message}`)
    process.exitCode = 1
  }
}
