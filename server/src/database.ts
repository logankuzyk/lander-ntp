import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type Migration = {
  id: number
  up: (db: DatabaseSync) => void
}

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const db = new DatabaseSync(path)
  db.exec('PRAGMA busy_timeout = 5000')
  enableWriteAheadLogging(db)
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db, [])
  return db
}

// SQLite does not run the busy handler when two connections race to switch a fresh file to WAL,
// so `busy_timeout` alone is not enough: that statement fails at once with SQLITE_BUSY. Retry it
// for as long as a starting process would otherwise wait for a lock.
function enableWriteAheadLogging(db: DatabaseSync): void {
  const sqliteBusy = 5
  const deadline = Date.now() + 5000
  for (;;) {
    try {
      db.exec('PRAGMA journal_mode = WAL')
      return
    } catch (error) {
      const code = (error as { errcode?: number }).errcode
      if (code !== sqliteBusy || Date.now() >= deadline) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
}

export function runMigrations(db: DatabaseSync, migrations: Migration[]): void {
  db.exec('CREATE TABLE IF NOT EXISTS server_migrations (id INTEGER PRIMARY KEY)')

  const ordered = [...migrations].sort((left, right) => left.id - right.id)
  for (const [index, migration] of ordered.entries()) {
    if (index > 0 && ordered[index - 1]?.id === migration.id) {
      throw new Error(`Duplicate server migration ${migration.id}`)
    }
  }

  for (const migration of ordered) {
    db.exec('BEGIN IMMEDIATE')
    try {
      const applied = db.prepare('SELECT 1 FROM server_migrations WHERE id = ?').get(migration.id)
      if (applied) {
        db.exec('COMMIT')
        continue
      }

      migration.up(db)
      db.prepare('INSERT INTO server_migrations (id) VALUES (?)').run(migration.id)
      db.exec('COMMIT')
    } catch (error) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // Preserve the migration error when SQLite has already ended the transaction.
      }
      throw error
    }
  }
}
