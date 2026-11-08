import { deleteAccount, exportAccount } from './accounts.js'
import { publishDeletedIds } from './backups.js'
import { loadConfig } from './config.js'
import { openDatabase } from './database.js'
import { createDirectoryObjectStore, createR2ObjectStore } from './objectStore.js'

const [command, emailArgument] = process.argv.slice(2)
if ((command !== 'export-account' && command !== 'delete-account') || !emailArgument) {
  throw new Error('Usage: accountCli.js <export-account|delete-account> <email>')
}

const config = loadConfig()
const db = openDatabase(config.databasePath)
const objectStore = config.r2
  ? createR2ObjectStore(config.r2)
  : createDirectoryObjectStore(config.objectStoreDirectory ?? 'data/objects')

try {
  if (command === 'delete-account') {
    const user = db
      .prepare('SELECT id FROM user WHERE lower(email) = ?')
      .get(emailArgument.toLowerCase()) as { id: string } | undefined
    if (!user) throw new Error('Account not found')
    deleteAccount(db, user.id, new Date())
    await publishDeletedIds(db, objectStore, new Date())
    console.info('Account deleted')
  } else {
    const exported = exportAccount(db, emailArgument)
    if (!exported) throw new Error('Account not found')
    console.info(JSON.stringify(exported, null, 2))
  }
} finally {
  db.close()
}
