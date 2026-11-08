import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { gunzip, gzip } from 'node:zlib'

import type { ObjectStore } from './objectStore.js'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)
const dumpPrefix = 'dumps/'
const deletedIdsKey = 'deleted-ids.json'
const retentionMs = 30 * 24 * 60 * 60 * 1000

export type DeletedAccount = { deletedAt: string; id: string }

export type BackupDependencies = {
  clock: { now: () => Date }
  databasePath: string
  db: DatabaseSync
  heartbeat?: () => Promise<void>
  logger?: Pick<Console, 'error' | 'info'>
  objectStore: ObjectStore
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}

function timestamp(date: Date): string {
  return date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')
}

function dateFromDumpKey(key: string): Date | undefined {
  const match = key.match(/^dumps\/lander-(\d{8}T\d{6}Z)\.db\.gz$/)
  if (!match?.[1]) return undefined
  const value = match[1]
  const isoDate = [
    value.slice(0, 4),
    '-',
    value.slice(4, 6),
    '-',
    value.slice(6, 8),
    'T',
    value.slice(9, 11),
    ':',
    value.slice(11, 13),
    ':',
    value.slice(13, 15),
    'Z',
  ].join('')
  const date = new Date(isoDate)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function ensureDeletedAccountsTable(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS deleted_account (
    user_id TEXT PRIMARY KEY,
    deleted_at TEXT NOT NULL
  )`)
}

export class Backups {
  private readonly db: DatabaseSync
  private readonly dependencies: BackupDependencies

  constructor(dependencies: BackupDependencies) {
    this.dependencies = dependencies
    this.db = dependencies.db
    ensureDeletedAccountsTable(this.db)
  }

  async ensureRecentDump(): Promise<string | undefined> {
    return (await this.hasRecentDump()) ? undefined : this.runNightly()
  }

  async hasRecentDump(now = this.dependencies.clock.now()): Promise<boolean> {
    const objects = await this.dependencies.objectStore.list(dumpPrefix)
    const newest = objects
      .map(({ key }) => dateFromDumpKey(key))
      .filter((date): date is Date => date !== undefined)
      .sort((left, right) => right.getTime() - left.getTime())[0]
    return newest !== undefined && now.getTime() - newest.getTime() <= 24 * 60 * 60 * 1000
  }

  async publishDeletedIds(): Promise<DeletedAccount[]> {
    const { clock, objectStore } = this.dependencies
    const now = clock.now()
    const cutoff = new Date(now.getTime() - retentionMs).toISOString()
    this.db.prepare('DELETE FROM deleted_account WHERE deleted_at < ?').run(cutoff)
    const rows = this.db
      .prepare(
        'SELECT user_id AS id, deleted_at AS deletedAt FROM deleted_account ORDER BY deleted_at',
      )
      .all() as DeletedAccount[]
    await objectStore.put(deletedIdsKey, new TextEncoder().encode(JSON.stringify(rows)))
    return rows
  }

  async runNightly(): Promise<string> {
    const { clock, db, heartbeat, logger = console, objectStore } = this.dependencies
    const now = clock.now()
    let temporaryDirectory: string | undefined
    try {
      await this.publishDeletedIds()
      temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'lander-dump-'))
      const copyPath = resolve(temporaryDirectory, 'snapshot.sqlite')
      db.exec(`VACUUM INTO '${escapeSqlString(copyPath)}'`)
      const bytes = await readFile(copyPath)
      const key = `${dumpPrefix}lander-${timestamp(now)}.db.gz`
      await objectStore.put(key, await gzipAsync(bytes))
      await this.prune(now)
      if (heartbeat) {
        try {
          await heartbeat()
        } catch (error) {
          logger.error('Nightly backup completed but heartbeat failed', error)
        }
      }
      logger.info(`Nightly database dump uploaded: ${key}`)
      return key
    } catch (error) {
      logger.error('Nightly database dump failed', error)
      throw error
    } finally {
      if (temporaryDirectory) await rm(temporaryDirectory, { force: true, recursive: true })
    }
  }

  private async prune(now: Date): Promise<void> {
    const cutoff = now.getTime() - retentionMs
    const objects = await this.dependencies.objectStore.list(dumpPrefix)
    await Promise.all(
      objects
        .filter(({ key }) => {
          const date = dateFromDumpKey(key)
          return date !== undefined && date.getTime() < cutoff
        })
        .map(({ key }) => this.dependencies.objectStore.delete(key)),
    )
  }
}

export type RestoreOptions = {
  liveDatabasePath: string
  objectStore: ObjectStore
  replace?: boolean
  targetPath: string
}

export type RestoreResult = { deletedAccounts: number; integrity: 'ok'; key: string }

function parseDeletedAccounts(data: Uint8Array | undefined): DeletedAccount[] {
  if (!data) return []
  const value: unknown = JSON.parse(new TextDecoder().decode(data))
  if (!Array.isArray(value)) throw new Error('Deleted ids object must contain an array')
  return value.map((item: unknown) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).id !== 'string' ||
      typeof (item as Record<string, unknown>).deletedAt !== 'string'
    ) {
      throw new Error('Deleted ids object has an invalid entry')
    }
    return {
      deletedAt: (item as Record<string, string>).deletedAt,
      id: (item as Record<string, string>).id,
    }
  })
}

export async function restoreDump(key: string, options: RestoreOptions): Promise<RestoreResult> {
  const { liveDatabasePath, objectStore, replace = false, targetPath } = options
  const destination = resolve(targetPath)
  if (!replace && destination === resolve(liveDatabasePath)) {
    throw new Error('Refusing to overwrite the live database without --replace')
  }
  let selectedKey = key
  if (key === 'latest') {
    const dumps = (await objectStore.list(dumpPrefix))
      .filter(({ key: candidate }) => dateFromDumpKey(candidate) !== undefined)
      .sort((left, right) => right.key.localeCompare(left.key))
    if (!dumps[0]) throw new Error('No database dumps are available')
    selectedKey = dumps[0].key
  }
  const compressed = await objectStore.get(selectedKey)
  if (!compressed) throw new Error(`Database dump not found: ${selectedKey}`)

  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'lander-restore-'))
  const temporaryDatabase = resolve(temporaryDirectory, 'restored.sqlite')
  try {
    await writeFile(temporaryDatabase, await gunzipAsync(compressed))
    const db = new DatabaseSync(temporaryDatabase)
    let deletedAccounts = 0
    try {
      const result = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string }
      if (result.integrity_check !== 'ok') {
        throw new Error('Restored database failed integrity_check')
      }
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string
      }[]
      if (!tables.some(({ name }) => name === 'user')) {
        throw new Error('Restored database does not contain the user table')
      }
      db.exec('PRAGMA foreign_keys = ON')
      ensureDeletedAccountsTable(db)
      const storedDeleted = db
        .prepare('SELECT user_id AS id, deleted_at AS deletedAt FROM deleted_account')
        .all() as DeletedAccount[]
      const allDeleted = new Map(storedDeleted.map((record) => [record.id, record]))
      for (const record of parseDeletedAccounts(await objectStore.get(deletedIdsKey))) {
        allDeleted.set(record.id, record)
      }
      const deletedIds = [...allDeleted.values()]
      const deleteUser = db.prepare('DELETE FROM "user" WHERE id = ?')
      const saveDeletion = db.prepare(
        `INSERT INTO deleted_account (user_id, deleted_at) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET deleted_at = excluded.deleted_at`,
      )
      for (const { deletedAt, id } of deletedIds) {
        deletedAccounts += Number(deleteUser.run(id).changes)
        saveDeletion.run(id, deletedAt)
      }
    } finally {
      db.close()
    }

    const integrityDb = new DatabaseSync(temporaryDatabase)
    try {
      const result = integrityDb.prepare('PRAGMA integrity_check').get() as {
        integrity_check?: string
      }
      if (result.integrity_check !== 'ok') {
        throw new Error('Restored database failed integrity_check')
      }
    } finally {
      integrityDb.close()
    }
    await mkdir(dirname(destination), { recursive: true })
    const stagedPath = `${destination}.restore-${process.pid}`
    await copyFile(temporaryDatabase, stagedPath)
    await rename(stagedPath, destination)
    return { deletedAccounts, integrity: 'ok', key: selectedKey }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

