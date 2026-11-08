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
  MAIL_FROM: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  MAIL_REPLY_TO: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
  PORT: v.optional(v.pipe(v.string(), v.regex(/^\d+$/, 'PORT must contain digits only')), '3000'),
  RESEND_API_KEY: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  REVIEWER_CODE: v.optional(
    v.pipe(v.string(), v.regex(/^\d{6}$/, 'REVIEWER_CODE must be six digits')),
  ),
  REVIEWER_EMAIL: v.optional(v.pipe(v.string(), v.trim(), v.email())),
  TRUST_ANY_EXTENSION_ORIGIN: v.optional(v.picklist(['true', 'false']), 'false'),
  TRUST_PROXY_HEADER: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^[a-z0-9-]+$/i, 'TRUST_PROXY_HEADER must be a header name'),
    ),
  ),
  TRUSTED_EXTENSION_IDS: v.optional(v.string(), ''),
})

const chromeStoreExtensionId = 'ocglhjclnhfbgbccffinhioaangigioa'

export type ServerConfig = {
  authSecret: string
  databasePath: string
  mailFrom?: string
  mailReplyTo?: string
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  resendApiKey?: string
  reviewerCode?: string
  reviewerEmail?: string
  trustAnyExtensionOrigin: boolean
  trustedExtensionIds: string[]
  trustProxyHeader?: string
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
  if (Boolean(values.REVIEWER_EMAIL) !== Boolean(values.REVIEWER_CODE)) {
    throw new Error('REVIEWER_EMAIL and REVIEWER_CODE must be configured together')
  }
  if (
    values.NODE_ENV === 'production' &&
    (!values.RESEND_API_KEY || !values.MAIL_FROM || !values.MAIL_REPLY_TO)
  ) {
    throw new Error('RESEND_API_KEY, MAIL_FROM and MAIL_REPLY_TO are required in production')
  }
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
    mailFrom: values.MAIL_FROM,
    mailReplyTo: values.MAIL_REPLY_TO,
    nodeEnv: values.NODE_ENV,
    port,
    resendApiKey: values.RESEND_API_KEY,
    reviewerCode: values.REVIEWER_CODE,
    reviewerEmail: values.REVIEWER_EMAIL?.toLowerCase(),
    trustAnyExtensionOrigin,
    trustedExtensionIds: [
      ...new Set([
        chromeStoreExtensionId,
        ...values.TRUSTED_EXTENSION_IDS.split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ]),
    ],
    trustProxyHeader: values.TRUST_PROXY_HEADER?.toLowerCase(),
  }
}
