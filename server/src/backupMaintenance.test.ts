import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Backups } from './backups.js'
import { scheduleNightlyBackup, startBackupMaintenance } from './main.js'
import { createDirectoryObjectStore } from './objectStore.js'

const directories: string[] = []
const databases: DatabaseSync[] = []

afterEach(() => {
  vi.useRealTimers()
  for (const db of databases.splice(0)) {
    if (db.isOpen) db.close()
  }
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

function makeBackups(now: () => Date) {
  const directory = mkdtempSync(join(tmpdir(), 'lander-maintenance-'))
  directories.push(directory)
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  db.exec('CREATE TABLE user (id TEXT PRIMARY KEY)')
  const store = createDirectoryObjectStore(directory)
  return {
    backups: new Backups({ clock: { now }, databasePath: ':memory:', db, objectStore: store }),
    store,
  }
}

describe('backup maintenance', () => {
  it('checks whether a recent dump exists before creating the startup dump', async () => {
    const now = new Date('2026-01-31T03:17:00.000Z')
    const { backups, store } = makeBackups(() => now)
    await store.put(
      'dumps/lander-20260130T031700Z.db.gz',
      new Uint8Array([1]),
    )
    const run = vi.spyOn(backups, 'runNightly')
    const maintenance = startBackupMaintenance(backups, { now: () => now })

    await maintenance.startup

    expect(run).not.toHaveBeenCalled()
    maintenance.stop()
  })

  it('runs nightly and schedules the next run after completion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-31T03:16:00.000Z'))
    const { backups } = makeBackups(() => new Date())
    const run = vi.spyOn(backups, 'runNightly').mockResolvedValue('dumps/backup.db.gz')
    const stop = scheduleNightlyBackup(backups, { now: () => new Date() })

    await vi.advanceTimersByTimeAsync(60_000)

    expect(run).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    stop()
  })
})
