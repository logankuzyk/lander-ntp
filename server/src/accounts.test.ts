import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { deleteAccount, deleteInactiveAccounts, exportAccount } from './accounts.js'

const databases: DatabaseSync[] = []
const now = new Date('2026-11-01T00:00:00.000Z')

function makeDatabase() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE session (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id) ON DELETE CASCADE);
    CREATE TABLE account (id TEXT PRIMARY KEY, userId TEXT REFERENCES user(id) ON DELETE CASCADE);
    CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT);
    CREATE TABLE settings_account (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, last_used_at INTEGER);
    CREATE TABLE settings_item (user_id TEXT REFERENCES user(id) ON DELETE CASCADE, item TEXT);
    CREATE TABLE deleted_account (user_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL);
  `)
  return db
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

describe('account deletion', () => {
  it('records deletion and cascades all account data, and repeats as a no-op', () => {
    const db = makeDatabase()
    db.exec(`
      INSERT INTO user VALUES ('u1', 'person@example.test');
      INSERT INTO session VALUES ('s1', 'u1');
      INSERT INTO account VALUES ('a1', 'u1');
      INSERT INTO verification VALUES ('v1', 'sign-in-otp-person@example.test');
      INSERT INTO settings_account VALUES ('u1', 1);
      INSERT INTO settings_item VALUES ('u1', 'layout');
    `)

    expect(deleteAccount(db, 'u1', now)).toBe(true)
    expect(deleteAccount(db, 'u1', new Date(now.getTime() + 60_000))).toBe(false)
    for (const table of ['user', 'session', 'account', 'settings_account', 'settings_item']) {
      expect(db.prepare(`SELECT * FROM ${table}`).all(), table).toEqual([])
    }
    expect(db.prepare('SELECT * FROM verification').all()).toEqual([])
    expect(db.prepare('SELECT user_id, deleted_at FROM deleted_account').all()).toEqual([
      { deleted_at: now.toISOString(), user_id: 'u1' },
    ])
  })

  it('removes accounts unused for over twelve months and exempts the reviewer', () => {
    const db = makeDatabase()
    const elevenMonthsAgo = new Date(now)
    elevenMonthsAgo.setUTCMonth(elevenMonthsAgo.getUTCMonth() - 11)
    const thirteenMonthsAgo = new Date(now)
    thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13)
    const stamp = (date: Date) => date.getTime()
    db.prepare('INSERT INTO user VALUES (?, ?)').run('recent', 'recent@example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, ?)').run('recent', stamp(elevenMonthsAgo))
    db.prepare('INSERT INTO user VALUES (?, ?)').run('stale', 'stale@example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, ?)').run('stale', stamp(thirteenMonthsAgo))
    db.prepare('INSERT INTO user VALUES (?, ?)').run('reviewer', 'reviewer@example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, ?)').run(
      'reviewer',
      stamp(thirteenMonthsAgo),
    )

    expect(deleteInactiveAccounts(db, now, 'reviewer@example.test')).toBe(1)
    expect(db.prepare('SELECT id FROM user ORDER BY id').all()).toEqual([
      { id: 'recent' },
      { id: 'reviewer' },
    ])
  })

  it('keeps accounts without a settings record and accounts exactly at the cutoff', () => {
    const db = makeDatabase()
    const cutoff = now.getTime() - 365 * 24 * 60 * 60 * 1000
    db.prepare('INSERT INTO user VALUES (?, ?)').run('no-settings', 'new@example.test')
    db.prepare('INSERT INTO user VALUES (?, ?)').run('boundary', 'boundary@example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, ?)').run('boundary', cutoff)

    expect(deleteInactiveAccounts(db, now)).toBe(0)
    expect(db.prepare('SELECT id FROM user ORDER BY id').all()).toEqual([
      { id: 'boundary' },
      { id: 'no-settings' },
    ])
  })

  it('does not delete accounts when the settings table is unavailable', () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    db.exec('CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL)')
    db.prepare('INSERT INTO user VALUES (?, ?)').run('u1', 'person@example.test')

    expect(deleteInactiveAccounts(db, now)).toBe(0)
    expect(db.prepare('SELECT id FROM user').all()).toEqual([{ id: 'u1' }])
  })

  it('cleans never-used settings rows and matches reviewer addresses without case sensitivity', () => {
    const db = makeDatabase()
    db.prepare('INSERT INTO user VALUES (?, ?)').run('never-used', 'never@example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, NULL)').run('never-used')
    db.prepare('INSERT INTO user VALUES (?, ?)').run('reviewer', 'Reviewer@Example.test')
    db.prepare('INSERT INTO settings_account VALUES (?, ?)').run(
      'reviewer',
      now.getTime() - 13 * 30 * 24 * 60 * 60 * 1000,
    )

    expect(deleteInactiveAccounts(db, now, 'reviewer@example.test')).toBe(1)
    expect(db.prepare('SELECT id FROM user').all()).toEqual([{ id: 'reviewer' }])
  })

  it('exports an account when the requested email uses different casing', () => {
    const db = makeDatabase()
    db.exec(`
      ALTER TABLE user ADD COLUMN name TEXT;
      ALTER TABLE user ADD COLUMN createdAt TEXT;
      ALTER TABLE user ADD COLUMN updatedAt TEXT;
      ALTER TABLE session ADD COLUMN userAgent TEXT;
      ALTER TABLE session ADD COLUMN createdAt TEXT;
      ALTER TABLE session ADD COLUMN updatedAt TEXT;
      ALTER TABLE settings_item ADD COLUMN v INTEGER;
      ALTER TABLE settings_item ADD COLUMN value TEXT;
    `)
    db.prepare(
      'INSERT INTO user (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    ).run('u1', 'person@example.test', 'Person', 'created', 'updated')

    expect(exportAccount(db, 'PERSON@EXAMPLE.TEST')?.user.email).toBe('person@example.test')
  })

  it('exports settings and reduced devices without IP addresses or tokens', () => {
    const db = makeDatabase()
    db.exec(`
      ALTER TABLE user ADD COLUMN name TEXT;
      ALTER TABLE user ADD COLUMN createdAt TEXT;
      ALTER TABLE user ADD COLUMN updatedAt TEXT;
      ALTER TABLE session ADD COLUMN userAgent TEXT;
      ALTER TABLE session ADD COLUMN ipAddress TEXT;
      ALTER TABLE session ADD COLUMN createdAt TEXT;
      ALTER TABLE session ADD COLUMN updatedAt TEXT;
      ALTER TABLE settings_item ADD COLUMN v INTEGER;
      ALTER TABLE settings_item ADD COLUMN value TEXT;
    `)
    db.prepare(
      'INSERT INTO user (id, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    ).run('u1', 'person@example.test', 'Person', 'created', 'updated')
    db.prepare(
      'INSERT INTO session (id, userId, userAgent, ipAddress, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('s1', 'u1', 'Chrome/120.0 (Mac OS X)', '192.0.2.1', 'created', 'used')
    db.prepare('INSERT INTO settings_item (user_id, item, v, value) VALUES (?, ?, ?, ?)').run(
      'u1',
      'layout',
      1,
      '{"v":1}',
    )

    const exported = exportAccount(db, 'person@example.test')

    expect(exported).toMatchObject({
      devices: [{ browser: 'Chrome', id: 's1', lastUsedAt: 'used', os: 'macOS' }],
      settings: { layout: { v: 1, value: { v: 1 } } },
      user: { email: 'person@example.test' },
    })
    expect(JSON.stringify(exported)).not.toContain('192.0.2.1')
    expect(JSON.stringify(exported)).not.toContain('ipAddress')
    expect(JSON.stringify(exported)).not.toContain('accessToken')
  })
})
