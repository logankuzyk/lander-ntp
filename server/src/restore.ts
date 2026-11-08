import { pathToFileURL } from 'node:url'

import { restoreDump } from './backups.js'
import { loadBackupConfig } from './config.js'
import { createDirectoryObjectStore, createR2ObjectStore } from './objectStore.js'

export async function runRestore(args: string[]): Promise<void> {
  const key = args[0]
  const targetIndex = args.indexOf('--to')
  const targetPath = targetIndex >= 0 ? args[targetIndex + 1] : undefined
  const replace = args.includes('--replace')
  if (!key || !targetPath || targetIndex < 0) {
    throw new Error('Usage: npm run restore -- <object key or latest> --to <path> [--replace]')
  }
  const config = loadBackupConfig()
  const objectStore = config.r2
    ? createR2ObjectStore(config.r2)
    : createDirectoryObjectStore(config.objectStoreDirectory ?? 'data/objects')
  const result = await restoreDump(key, {
    liveDatabasePath: config.databasePath,
    objectStore,
    replace,
    targetPath,
  })
  console.info(
    `Restored ${result.key}; integrity_check=${result.integrity}; ` +
      `deleted accounts removed=${result.deletedAccounts}`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runRestore(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown restore error'
    console.error(`Restore failed: ${message}`)
    process.exitCode = 1
  }
}
