import type { DatabaseSync } from 'node:sqlite'

import { itemBytes, syncedShapes } from '@/sync/shapes/index.js'

export type SyncItem = 'layout' | 'onboarding' | 'settings'
export type StoredItem = { v: number; value: unknown }
export type SettingsSnapshot = { items: Partial<Record<SyncItem, StoredItem>>; rev: number }
export type PutResult = { changed: boolean; rev: number; saved: StoredItem }
export type PutError = 'invalid' | 'older_version' | 'too_large' | 'unknown_item'

export class SettingsStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
  ) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings_account (
        user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
        rev INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS settings_item (
        user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        item TEXT NOT NULL,
        v INTEGER NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, item)
      );
    `)
  }

  get(userId: string): SettingsSnapshot {
    this.ensureAccount(userId)
    const account = this.db
      .prepare('SELECT rev FROM settings_account WHERE user_id = ?')
      .get(userId) as { rev: number }
    const items: SettingsSnapshot['items'] = {}
    const rows = this.db
      .prepare('SELECT item, v, value FROM settings_item WHERE user_id = ?')
      .all(userId) as { item: string; v: number; value: string }[]
    for (const row of rows) {
      if (isSyncItem(row.item)) items[row.item] = { v: row.v, value: JSON.parse(row.value) }
    }
    return { items, rev: account.rev }
  }

  put(userId: string, item: string, value: unknown): PutError | PutResult {
    if (!isSyncItem(item)) return 'unknown_item'
    if (itemBytes(item, value) > 8192) return 'too_large'
    const version = itemVersion(item, value)
    if (version === undefined) return 'invalid'
    const json = JSON.stringify(value)

    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.ensureAccount(userId)
      const existing = this.db
        .prepare('SELECT v, value FROM settings_item WHERE user_id = ? AND item = ?')
        .get(userId, item) as { v: number; value: string } | undefined
      if (existing && version < existing.v) {
        this.db.exec('ROLLBACK')
        return 'older_version'
      }
      if (existing && version === existing.v && existing.value === json) {
        const account = this.db
          .prepare('SELECT rev FROM settings_account WHERE user_id = ?')
          .get(userId) as { rev: number }
        this.db.exec('COMMIT')
        return { changed: false, rev: account.rev, saved: { v: existing.v, value } }
      }
      this.db
        .prepare(
          `INSERT INTO settings_item (user_id, item, v, value, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, item) DO UPDATE SET
             v = excluded.v, value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(userId, item, version, json, this.clock.now().getTime())
      this.db.prepare('UPDATE settings_account SET rev = rev + 1 WHERE user_id = ?').run(userId)
      const account = this.db
        .prepare('SELECT rev FROM settings_account WHERE user_id = ?')
        .get(userId) as { rev: number }
      this.db.exec('COMMIT')
      return { changed: true, rev: account.rev, saved: { v: version, value } }
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        // Keep the original SQLite failure.
      }
      throw error
    }
  }

  touch(userId: string, now: Date): void {
    this.ensureAccount(userId)
    this.db
      .prepare(
        `UPDATE settings_account SET last_used_at = ?
         WHERE user_id = ? AND (last_used_at IS NULL OR last_used_at <= ?)`,
      )
      .run(now.getTime(), userId, now.getTime() - 60 * 60 * 1000)
  }

  private ensureAccount(userId: string): void {
    this.db
      .prepare('INSERT INTO settings_account (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING')
      .run(userId)
  }
}

function isSyncItem(item: string): item is SyncItem {
  return item === 'layout' || item === 'settings' || item === 'onboarding'
}

function itemVersion(item: SyncItem, value: unknown): number | undefined {
  if (item === 'settings' || item === 'onboarding') {
    const checked = syncedShapes[item].check(value)
    return checked.ok ? checked.v : undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const version = 'v' in value ? value.v : 1
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 1
    ? version
    : undefined
}
