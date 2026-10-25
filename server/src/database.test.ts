import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { openDatabase, runMigrations } from './database.js'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), 'lander-server-'))
  directories.push(directory)
  return join(directory, 'server.sqlite')
}

describe('openDatabase', () => {
  it('enables WAL, foreign keys, and a busy timeout', () => {
    const db = openDatabase(databasePath())
    try {
      expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
      expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
      expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 })
    } finally {
      db.close()
    }
  })

  it('applies ordered migrations once each', () => {
    const db = openDatabase(databasePath())
    const applied: number[] = []
    const migrations = [
      { id: 2, up: () => applied.push(2) },
      { id: 1, up: () => applied.push(1) },
    ]
    try {
      runMigrations(db, migrations)
      runMigrations(db, migrations)
      expect(applied).toEqual([1, 2])
    } finally {
      db.close()
    }
  })

  it('serializes the same migration across concurrent server starts', async () => {
    const path = databasePath()
    const moduleUrl = new URL('./database.ts', import.meta.url).href
    const source = `
      import { DatabaseSync } from 'node:sqlite'
      import { runMigrations } from ${JSON.stringify(moduleUrl)}
      const db = new DatabaseSync(process.argv[1])
      db.exec('PRAGMA busy_timeout = 5000')
      runMigrations(db, [{ id: 1, up(database) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
        database.exec('CREATE TABLE things (id INTEGER)')
      } }])
      db.close()
    `
    const starts = Array.from(
      { length: 6 },
      () =>
        new Promise<number>((resolve, reject) => {
          const child = spawn(process.execPath, ['--input-type=module', '--eval', source, path])
          child.once('error', reject)
          child.once('exit', (code) => resolve(code ?? 1))
        }),
    )
    const exitCodes = await Promise.all(starts)
    const db = openDatabase(path)
    try {
      expect(exitCodes).toEqual([0, 0, 0, 0, 0, 0])
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'things'").get()).toEqual({
        name: 'things',
      })
      expect(db.prepare('SELECT id FROM server_migrations').all()).toEqual([{ id: 1 }])
    } finally {
      db.close()
    }
  })

  it('rolls back a failed migration without recording its id', () => {
    const db = openDatabase(':memory:')
    try {
      expect(() =>
        runMigrations(db, [
          {
            id: 3,
            up(database) {
              database.exec('CREATE TABLE partial_change (id INTEGER)')
              throw new Error('migration failed')
            },
          },
        ]),
      ).toThrow('migration failed')
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'partial_change'").get()).toBe(
        undefined,
      )
      expect(db.prepare('SELECT id FROM server_migrations WHERE id = 3').get()).toBeUndefined()
    } finally {
      db.close()
    }
  })

  it('preserves the migration error if SQLite has already ended the transaction', () => {
    const db = openDatabase(':memory:')
    try {
      expect(() =>
        runMigrations(db, [
          {
            id: 4,
            up(database) {
              database.exec('COMMIT')
              throw new Error('original migration error')
            },
          },
        ]),
      ).toThrow('original migration error')
    } finally {
      db.close()
    }
  })

  it('rejects duplicate migration ids', () => {
    const db = openDatabase(':memory:')
    try {
      expect(() =>
        runMigrations(db, [
          { id: 5, up: () => undefined },
          { id: 5, up: () => undefined },
        ]),
      ).toThrow('Duplicate server migration 5')
    } finally {
      db.close()
    }
  })
})
