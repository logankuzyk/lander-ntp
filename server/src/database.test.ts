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
})
