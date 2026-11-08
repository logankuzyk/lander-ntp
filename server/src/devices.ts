import type { DatabaseSync } from 'node:sqlite'

import { runMigrations } from './database.js'

const deviceLimit = 3
const sessionLifetimeMs = 60 * 24 * 60 * 60 * 1000
const pendingLifetimeMs = 15 * 60 * 1000

type SessionRow = {
  createdAt: string
  expiresAt: string
  id: string
  pending: number
  updatedAt: string
  userAgent: string | null
  userId: string
}

export type Device = {
  browser: string
  createdAt: string
  current: boolean
  id: string
  lastUsedAt: string
  os: string
}

export class Devices {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
  ) {
    runMigrations(db, [
      {
        id: 1,
        up: (database) => {
          database.exec('ALTER TABLE session ADD COLUMN pending INTEGER NOT NULL DEFAULT 0')
        },
      },
    ])
  }

  // Returns true when the session must choose a device to remove before it can sync.
  admit(userId: string, sessionId: string, reviewer = false): boolean {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const now = this.clock.now()
      this.prune(now)
      const current = this.db
        .prepare('SELECT id, userId FROM session WHERE id = ?')
        .get(sessionId) as { id: string; userId: string } | undefined
      if (!current || current.userId !== userId) {
        this.db.exec('COMMIT')
        return false
      }

      if (reviewer) {
        const active = this.db
          .prepare(
            `SELECT COUNT(*) AS count FROM session
             WHERE userId = ? AND id != ? AND pending = 0 AND expiresAt > ?`,
          )
          .get(userId, sessionId, now.toISOString()) as { count: number }
        if (active.count >= deviceLimit) {
          const oldest = this.db
            .prepare(
              `SELECT id FROM session
               WHERE userId = ? AND id != ? AND pending = 0 AND expiresAt > ?
               ORDER BY createdAt ASC, id ASC LIMIT 1`,
            )
            .get(userId, sessionId, now.toISOString()) as { id: string } | undefined
          if (oldest) this.db.prepare('DELETE FROM session WHERE id = ?').run(oldest.id)
        }
        this.db.prepare('UPDATE session SET pending = 0 WHERE id = ?').run(sessionId)
        this.db.exec('COMMIT')
        return false
      }

      const active = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM session
           WHERE userId = ? AND id != ? AND pending = 0 AND expiresAt > ?`,
        )
        .get(userId, sessionId, now.toISOString()) as { count: number }
      const pending = active.count >= deviceLimit
      if (pending) {
        this.db
          .prepare('UPDATE session SET pending = 1, expiresAt = ? WHERE id = ?')
          .run(new Date(now.getTime() + pendingLifetimeMs).toISOString(), sessionId)
      } else {
        this.db.prepare('UPDATE session SET pending = 0 WHERE id = ?').run(sessionId)
      }
      this.db.exec('COMMIT')
      return pending
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  isPending(userId: string, sessionId: string): boolean {
    this.pruneExpired()
    const row = this.db
      .prepare('SELECT pending FROM session WHERE id = ? AND userId = ? AND expiresAt > ?')
      .get(sessionId, userId, this.clock.now().toISOString()) as { pending: number } | undefined
    return Boolean(row?.pending)
  }

  list(userId: string, currentSessionId: string) {
    const now = this.clock.now()
    this.pruneExpired()
    const rows = this.db
      .prepare(
        `SELECT id, userId, expiresAt, createdAt, updatedAt, userAgent, pending
         FROM session WHERE userId = ? AND expiresAt > ?
         ORDER BY createdAt DESC, id ASC`,
      )
      .all(userId, now.toISOString()) as SessionRow[]
    return {
      devices: rows.map((row) => ({
        browser: parseUserAgent(row.userAgent).browser,
        createdAt: row.createdAt,
        current: row.id === currentSessionId,
        id: row.id,
        lastUsedAt: row.updatedAt,
        os: parseUserAgent(row.userAgent).os,
      })),
      pending: rows.some((row) => row.id === currentSessionId && Boolean(row.pending)),
    }
  }

  pruneExpired(): void {
    const now = this.clock.now()
    this.prune(now)
  }

  remove(userId: string, deviceId: string, bySessionId: string): boolean {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const caller = this.db
        .prepare('SELECT id, userId, pending FROM session WHERE id = ?')
        .get(bySessionId) as { id: string; pending: number; userId: string } | undefined
      if (!caller || caller.userId !== userId) {
        this.db.exec('COMMIT')
        return false
      }
      const target = this.db
        .prepare('SELECT id FROM session WHERE id = ? AND userId = ?')
        .get(deviceId, userId)
      if (!target) {
        this.db.exec('COMMIT')
        return false
      }
      this.db.prepare('DELETE FROM session WHERE id = ? AND userId = ?').run(deviceId, userId)
      if (caller.pending && deviceId !== bySessionId) {
        const now = this.clock.now()
        this.prune(now)
        const active = this.db
          .prepare(
            `SELECT COUNT(*) AS count FROM session
             WHERE userId = ? AND pending = 0 AND expiresAt > ?`,
          )
          .get(userId, now.toISOString()) as { count: number }
        if (active.count < deviceLimit) {
          this.db
            .prepare('UPDATE session SET pending = 0, expiresAt = ? WHERE id = ?')
            .run(new Date(now.getTime() + sessionLifetimeMs).toISOString(), bySessionId)
        }
      }
      this.db.exec('COMMIT')
      return true
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private prune(now: Date): void {
    this.db
      .prepare('DELETE FROM session WHERE expiresAt <= ? OR (pending = 1 AND createdAt <= ?)')
      .run(now.toISOString(), new Date(now.getTime() - pendingLifetimeMs).toISOString())
  }
}

export function parseUserAgent(value: string | null | undefined): { browser: string; os: string } {
  const agent = value ?? ''
  let browser = 'Unknown'
  if (/Edg\//.test(agent)) browser = 'Edge'
  else if (/Firefox\//.test(agent)) browser = 'Firefox'
  else if (/Chrome\//.test(agent)) browser = 'Chrome'

  let os = 'Unknown'
  if (/Android/.test(agent)) os = 'Android'
  else if (/CrOS/.test(agent)) os = 'ChromeOS'
  else if (/Windows NT/.test(agent)) os = 'Windows'
  else if (/Mac OS X/.test(agent)) os = 'macOS'
  else if (/Linux/.test(agent)) os = 'Linux'

  return { browser, os }
}
