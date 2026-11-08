import type { DatabaseSync } from 'node:sqlite'

import { parseUserAgent } from './devices.js'

export const inactiveAccountAgeMs = 365 * 24 * 60 * 60 * 1000

export function exportAccount(db: DatabaseSync, email: string) {
  const user = db
    .prepare('SELECT id, email, name, createdAt, updatedAt FROM user WHERE lower(email) = ?')
    .get(email.toLowerCase()) as
    { createdAt: string; email: string; id: string; name: string; updatedAt: string } | undefined
  if (!user) return undefined
  const items = db
    .prepare('SELECT item, v, value FROM settings_item WHERE user_id = ? ORDER BY item')
    .all(user.id) as { item: string; v: number; value: string }[]
  const sessions = db
    .prepare(
      'SELECT id, userAgent, createdAt, updatedAt FROM session WHERE userId = ? ORDER BY createdAt',
    )
    .all(user.id) as {
    createdAt: string
    id: string
    updatedAt: string
    userAgent: string | null
  }[]
  return {
    devices: sessions.map((session) => ({
      ...parseUserAgent(session.userAgent),
      createdAt: session.createdAt,
      id: session.id,
      lastUsedAt: session.updatedAt,
    })),
    settings: Object.fromEntries(
      items.map(({ item, v, value }) => [item, { v, value: JSON.parse(value) as unknown }]),
    ),
    user: {
      createdAt: user.createdAt,
      email: user.email,
      name: user.name,
      updatedAt: user.updatedAt,
    },
  }
}

export function deleteAccount(db: DatabaseSync, userId: string, now: Date): boolean {
  db.exec('BEGIN IMMEDIATE')
  try {
    const user = db.prepare('SELECT email FROM user WHERE id = ?').get(userId) as
      { email: string } | undefined
    if (!user) {
      db.exec('COMMIT')
      return false
    }
    db.prepare(
      `INSERT INTO deleted_account (user_id, deleted_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET deleted_at = excluded.deleted_at`,
    ).run(userId, now.toISOString())
    db.prepare(
      'DELETE FROM verification WHERE identifier = ? OR substr(identifier, -length(?)) = ?',
    ).run(user.email, user.email, user.email)
    db.prepare('DELETE FROM "user" WHERE id = ?').run(userId)
    db.exec('COMMIT')
    return true
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // Preserve the original database error.
    }
    throw error
  }
}

export function deleteInactiveAccounts(
  db: DatabaseSync,
  now: Date,
  reviewerEmail?: string,
): number {
  const settingsTable = db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'settings_account'")
    .get()
  if (!settingsTable) return 0
  const cutoff = now.getTime() - inactiveAccountAgeMs
  const accounts = db
    .prepare(
      `SELECT user.id FROM user
       JOIN settings_account ON settings_account.user_id = user.id
       WHERE (settings_account.last_used_at IS NULL OR settings_account.last_used_at < ?)
         AND (? IS NULL OR lower(user.email) != ?)`,
    )
    .all(cutoff, reviewerEmail ?? null, reviewerEmail ?? null) as { id: string }[]
  return accounts.reduce((count, account) => count + Number(deleteAccount(db, account.id, now)), 0)
}
