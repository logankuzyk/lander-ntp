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
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  runMigrations(db, [])
  return db
}

export function runMigrations(db: DatabaseSync, migrations: Migration[]): void {
  db.exec('CREATE TABLE IF NOT EXISTS server_migrations (id INTEGER PRIMARY KEY)')

  const ids = new Set<number>()

  for (const migration of [...migrations].sort((left, right) => left.id - right.id)) {
    if (ids.has(migration.id)) throw new Error(`Duplicate server migration ${migration.id}`)
    ids.add(migration.id)

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
