import * as v from 'valibot'

const environmentSchema = v.object({
  AUTH_SECRET: v.pipe(
    v.string('AUTH_SECRET is required'),
    v.minLength(32, 'AUTH_SECRET must be at least 32 characters'),
  ),
  DATABASE_PATH: v.optional(v.string(), 'data/lander.sqlite'),
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/)), '3000'),
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
  const result = v.safeParse(environmentSchema, environment)
  if (!result.success) {
    const message = result.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid server configuration: ${message}`)
  }

  const values = result.output
  const trustAnyExtensionOrigin = values.TRUST_ANY_EXTENSION_ORIGIN === 'true'
  if (values.NODE_ENV === 'production' && trustAnyExtensionOrigin) {
    throw new Error(
      'Invalid server configuration: TRUST_ANY_EXTENSION_ORIGIN is not allowed in production',
    )
  }

  return {
    authSecret: values.AUTH_SECRET,
    databasePath: values.DATABASE_PATH,
    nodeEnv: values.NODE_ENV,
    port: Number(values.PORT),
    trustAnyExtensionOrigin,
  }
}
