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

  const applied = new Set(
    db
      .prepare('SELECT id FROM server_migrations')
      .all()
      .map((row) => Number(row.id)),
  )
  const ids = new Set<number>()

  for (const migration of [...migrations].sort((left, right) => left.id - right.id)) {
    if (ids.has(migration.id)) throw new Error(`Duplicate server migration ${migration.id}`)
    ids.add(migration.id)
    if (applied.has(migration.id)) continue

    db.exec('BEGIN')
    try {
      migration.up(db)
      db.prepare('INSERT INTO server_migrations (id) VALUES (?)').run(migration.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
}
