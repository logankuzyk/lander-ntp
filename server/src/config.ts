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
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/, 'PORT must contain digits only')), '3000'),
  TRUST_ANY_EXTENSION_ORIGIN: v.optional(v.picklist(['true', 'false']), 'false'),
})

export type ServerConfig = {
  authSecret: string
  databasePath: string
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  trustAnyExtensionOrigin: boolean
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
    nodeEnv: values.NODE_ENV,
    port,
    trustAnyExtensionOrigin,
  }
}
