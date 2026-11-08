import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as v from 'valibot'

const environmentSchema = v.object({
  AUTH_SECRET: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(32, 'AUTH_SECRET must be at least 32 characters'),
  ),
  DATABASE_PATH: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1, 'DATABASE_PATH must not be empty')),
    'data/lander.sqlite',
  ),
  HEARTBEAT_URL: v.optional(v.pipe(v.string(), v.trim())),
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  OBJECT_STORE_DIR: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1, 'OBJECT_STORE_DIR must not be empty')),
    'data/objects',
  ),
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/, 'PORT must contain digits only')), '3000'),
  R2_ACCESS_KEY_ID: v.optional(v.pipe(v.string(), v.trim())),
  R2_ACCOUNT_ID: v.optional(v.pipe(v.string(), v.trim())),
  R2_BUCKET: v.optional(v.pipe(v.string(), v.trim())),
  R2_SECRET_ACCESS_KEY: v.optional(v.pipe(v.string(), v.trim())),
  TRUST_ANY_EXTENSION_ORIGIN: v.optional(v.picklist(['true', 'false']), 'false'),
  TRUSTED_EXTENSION_IDS: v.optional(v.string(), ''),
})

const backupEnvironmentSchema = v.object({
  DATABASE_PATH: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1, 'DATABASE_PATH must not be empty')),
    'data/lander.sqlite',
  ),
  OBJECT_STORE_DIR: v.optional(
    v.pipe(v.string(), v.trim(), v.minLength(1, 'OBJECT_STORE_DIR must not be empty')),
    'data/objects',
  ),
  R2_ACCESS_KEY_ID: v.optional(v.pipe(v.string(), v.trim())),
  R2_ACCOUNT_ID: v.optional(v.pipe(v.string(), v.trim())),
  R2_BUCKET: v.optional(v.pipe(v.string(), v.trim())),
  R2_SECRET_ACCESS_KEY: v.optional(v.pipe(v.string(), v.trim())),
})

const chromeStoreExtensionId = 'ocglhjclnhfbgbccffinhioaangigioa'

export type ServerConfig = {
  authSecret: string
  databasePath: string
  heartbeatUrl?: string
  nodeEnv: 'development' | 'production' | 'test'
  objectStoreDirectory?: string
  port: number
  r2?: { accessKeyId: string; accountId: string; bucket: string; secretAccessKey: string }
  trustAnyExtensionOrigin: boolean
  trustedExtensionIds: string[]
}

export type BackupConfig = {
  databasePath: string
  objectStoreDirectory: string
  r2?: NonNullable<ServerConfig['r2']>
}

export function loadBackupConfig(
  environment: Record<string, string | undefined> = process.env,
): BackupConfig {
  const result = v.safeParse(backupEnvironmentSchema, environment)
  if (!result.success) {
    const message = result.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid backup configuration: ${message}`)
  }
  const values = result.output
  const r2Values = [
    values.R2_ACCOUNT_ID,
    values.R2_BUCKET,
    values.R2_ACCESS_KEY_ID,
    values.R2_SECRET_ACCESS_KEY,
  ]
  if (r2Values.some(Boolean) && r2Values.some((value) => !value)) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set together',
    )
  }
  const serverDirectory = dirname(fileURLToPath(import.meta.url))
  return {
    databasePath:
      values.DATABASE_PATH === ':memory:'
        ? values.DATABASE_PATH
        : resolve(serverDirectory, '..', values.DATABASE_PATH),
    objectStoreDirectory: resolve(serverDirectory, '..', values.OBJECT_STORE_DIR),
    ...(values.R2_ACCOUNT_ID &&
    values.R2_BUCKET &&
    values.R2_ACCESS_KEY_ID &&
    values.R2_SECRET_ACCESS_KEY
      ? {
          r2: {
            accessKeyId: values.R2_ACCESS_KEY_ID,
            accountId: values.R2_ACCOUNT_ID,
            bucket: values.R2_BUCKET,
            secretAccessKey: values.R2_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  }
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  if (!environment.AUTH_SECRET) throw new Error('AUTH_SECRET is required')
  if (
    environment.NODE_ENV !== undefined &&
    !['development', 'production', 'test'].includes(environment.NODE_ENV)
  ) {
    throw new Error('NODE_ENV must be development, production, or test')
  }

  const result = v.safeParse(environmentSchema, environment)
  if (!result.success) {
    const message = result.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid server configuration: ${message}`)
  }

  const values = result.output
  const r2Values = [
    values.R2_ACCOUNT_ID,
    values.R2_BUCKET,
    values.R2_ACCESS_KEY_ID,
    values.R2_SECRET_ACCESS_KEY,
  ]
  if (r2Values.some(Boolean) && r2Values.some((value) => !value)) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set together',
    )
  }
  if (values.HEARTBEAT_URL) {
    try {
      new URL(values.HEARTBEAT_URL)
    } catch {
      throw new Error('HEARTBEAT_URL must be a URL')
    }
  }
  const port = Number(values.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  const trustAnyExtensionOrigin = values.TRUST_ANY_EXTENSION_ORIGIN === 'true'
  if (values.NODE_ENV === 'production' && trustAnyExtensionOrigin) {
    throw new Error(
      'Invalid server configuration: TRUST_ANY_EXTENSION_ORIGIN is not allowed in production',
    )
  }

  return {
    authSecret: values.AUTH_SECRET,
    databasePath:
      values.DATABASE_PATH === ':memory:'
        ? values.DATABASE_PATH
        : resolve(dirname(fileURLToPath(import.meta.url)), '..', values.DATABASE_PATH),
    ...(values.HEARTBEAT_URL ? { heartbeatUrl: values.HEARTBEAT_URL } : {}),
    nodeEnv: values.NODE_ENV,
    objectStoreDirectory: resolve(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      values.OBJECT_STORE_DIR,
    ),
    port,
    ...(values.R2_ACCOUNT_ID &&
    values.R2_BUCKET &&
    values.R2_ACCESS_KEY_ID &&
    values.R2_SECRET_ACCESS_KEY
      ? {
          r2: {
            accessKeyId: values.R2_ACCESS_KEY_ID,
            accountId: values.R2_ACCOUNT_ID,
            bucket: values.R2_BUCKET,
            secretAccessKey: values.R2_SECRET_ACCESS_KEY,
          },
        }
      : {}),
    trustAnyExtensionOrigin,
    trustedExtensionIds: [
      ...new Set([
        chromeStoreExtensionId,
        ...values.TRUSTED_EXTENSION_IDS.split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ]),
    ],
  }
}
