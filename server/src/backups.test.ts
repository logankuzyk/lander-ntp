import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Backups, restoreDump } from './backups.js'
import { createDirectoryObjectStore } from './objectStore.js'

const directories: string[] = []
const databases: DatabaseSync[] = []

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'lander-backup-'))
  directories.push(directory)
  const databasePath = join(directory, 'live.sqlite')
  const userId = randomUUID()
  const db = new DatabaseSync(databasePath)
  databases.push(db)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(
    `CREATE TABLE example (value TEXT);
     INSERT INTO example VALUES ('kept');
     CREATE TABLE user (id TEXT PRIMARY KEY);
     CREATE TABLE settings (
       user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
       value TEXT NOT NULL
     )`,
  )
  db.prepare('INSERT INTO user VALUES (?)').run(userId)
  db.prepare('INSERT INTO settings VALUES (?, ?)').run(userId, '{"theme":"dark"}')
  const store = createDirectoryObjectStore(join(directory, 'objects'))
  const now = new Date('2026-01-31T03:17:00.000Z')
  const backups = new Backups({
    clock: { now: () => now },
    databasePath,
    db,
    objectStore: store,
  })
  return {
    backups,
    databasePath,
    db,
    directory,
    store,
    userId,
  }
}

afterEach(() => {
  for (const db of databases.splice(0)) {
    if (db.isOpen) db.close()
  }
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
  vi.restoreAllMocks()
})

describe('Backups', () => {
  it('writes a compressed consistent database copy that passes SQLite integrity_check', async () => {
    const { backups, store } = fixture()

    const key = await backups.runNightly()
    const compressed = await store.get(key)

    expect(key).toBe('dumps/lander-20260131T031700Z.db.gz')
    expect(compressed).toBeDefined()
    const { gunzipSync } = await import('node:zlib')
    const { mkdtempSync: mkdtemp, writeFileSync } = await import('node:fs')
    const copyDir = mkdtemp(join(tmpdir(), 'lander-check-'))
    directories.push(copyDir)
    const copyPath = join(copyDir, 'copy.sqlite')
    writeFileSync(copyPath, gunzipSync(compressed!))
    const verified = new DatabaseSync(copyPath)
    expect(verified.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
    expect(verified.prepare('SELECT value FROM example').get()).toEqual({ value: 'kept' })
    expect(verified.prepare('SELECT value FROM settings').get()).toEqual({
      value: '{"theme":"dark"}',
    })
    verified.close()
  })

  it('keeps a 30-day dump, prunes a 31-day dump, and pings heartbeat only after success', async () => {
    const { store } = fixture()
    const ping = vi.fn(async () => undefined)
    const oldDb = new DatabaseSync(':memory:')
    databases.push(oldDb)
    oldDb.exec('CREATE TABLE user (id TEXT PRIMARY KEY)')
    const old = new Backups({
      clock: { now: () => new Date('2026-01-31T03:17:00.000Z') },
      databasePath: ':memory:',
      db: oldDb,
      heartbeat: ping,
      objectStore: store,
    })
    const { gzipSync } = await import('node:zlib')
    await store.put('dumps/lander-20260101T031700Z.db.gz', gzipSync(Buffer.from('dump')))
    await store.put('dumps/lander-20251231T031700Z.db.gz', gzipSync(Buffer.from('dump')))

    await old.runNightly()
    expect(await store.get('dumps/lander-20260101T031700Z.db.gz')).toBeDefined()
    expect(await store.get('dumps/lander-20251231T031700Z.db.gz')).toBeUndefined()
    expect(ping).toHaveBeenCalledTimes(1)
  })

  it('logs an upload failure and does not ping heartbeat', async () => {
    const { databasePath, db, store } = fixture()
    const ping = vi.fn(async () => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing = new Backups({
      clock: { now: () => new Date('2026-01-31T03:17:00.000Z') },
      databasePath,
      db,
      heartbeat: ping,
      objectStore: { ...store, put: async () => { throw new Error('upload failed') } },
    })

    await expect(failing.runNightly()).rejects.toThrow('upload failed')
    expect(error).toHaveBeenCalled()
    expect(ping).not.toHaveBeenCalled()
  })

  it('removes deleted users during restore and keeps the external deleted-ids list', async () => {
    const { backups, databasePath, db, directory, store, userId } = fixture()
    const oldDump = await backups.runNightly()

    db.prepare('INSERT INTO deleted_account (user_id, deleted_at) VALUES (?, ?)').run(
      userId,
      '2026-02-01T00:00:00.000Z',
    )
    await backups.publishDeletedIds()
    const targetPath = join(directory, 'restore.sqlite')
    const result = await restoreDump(oldDump, {
      liveDatabasePath: databasePath,
      objectStore: store,
      targetPath,
    })

    const restored = new DatabaseSync(targetPath)
    expect(restored.prepare('SELECT id FROM user').all()).toEqual([])
    expect(restored.prepare('SELECT user_id FROM settings').all()).toEqual([])
    expect(restored.prepare('SELECT user_id, deleted_at FROM deleted_account').all()).toEqual([
      { deleted_at: '2026-02-01T00:00:00.000Z', user_id: userId },
    ])
    expect(restored.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
    restored.close()
    const deletedIds = await store.get('deleted-ids.json')
    expect(JSON.parse(new TextDecoder().decode(deletedIds))).toEqual([
      { deletedAt: '2026-02-01T00:00:00.000Z', id: userId },
    ])
    expect(result.deletedAccounts).toBe(1)
  })

  it('refuses to replace the configured live database without explicit replace', async () => {
    const { backups, databasePath, store } = fixture()
    const key = await backups.runNightly()

    await expect(
      restoreDump(key, {
        liveDatabasePath: databasePath,
        objectStore: store,
        targetPath: databasePath,
      }),
    ).rejects.toThrow(/--replace/)
  })

  it('makes a missed night up at startup when no recent dump is present', async () => {
    const { backups, store } = fixture()
    await expect(backups.ensureRecentDump()).resolves.toBe('dumps/lander-20260131T031700Z.db.gz')
    await expect(backups.ensureRecentDump()).resolves.toBeUndefined()
    expect((await store.list('dumps/')).map(({ key }) => key)).toHaveLength(1)
  })

  it('prunes deleted ids after 30 days and keeps ids at the 30-day boundary', async () => {
    const { backups, db, store } = fixture()
    db.exec(
      `INSERT INTO deleted_account (user_id, deleted_at)
       VALUES ('expired-id', '2026-01-01T03:16:00.000Z'), ('kept-id', '2026-01-01T03:17:00.000Z')`,
    )

    const deleted = await backups.publishDeletedIds()

    expect(deleted).toEqual([{ deletedAt: '2026-01-01T03:17:00.000Z', id: 'kept-id' }])
    expect(await store.get('deleted-ids.json')).toEqual(
      new TextEncoder().encode('[{"id":"kept-id","deletedAt":"2026-01-01T03:17:00.000Z"}]'),
    )
  })
})
