import { betterAuth } from 'better-auth'
import { bearer, emailOTP } from 'better-auth/plugins'
import type { DatabaseSync } from 'node:sqlite'

import type { ServerConfig } from './config.js'

export type MailMessage = { subject: string; text: string; to: string }

export type Mailer = { send: (message: MailMessage) => Promise<void> }

type AuthDependencies = {
  config: ServerConfig
  db: DatabaseSync
  mailer: Mailer
}

export function sendSignInEmail(mailer: Mailer, email: string, code: string) {
  return mailer.send({
    subject: 'Your Lander sign-in code',
    text: `Your Lander sign-in code is ${code}. It expires in five minutes. Ignore this email if you did not ask for a code.`,
    to: email,
  })
}

export function createResendMailer(config: ServerConfig, fetcher: typeof fetch = fetch): Mailer {
  if (!config.resendApiKey || !config.mailFrom || !config.mailReplyTo) {
    throw new Error('Mail delivery is not configured')
  }

  return {
    send: async (message) => {
      const response = await fetcher('https://api.resend.com/emails', {
        body: JSON.stringify({
          from: config.mailFrom,
          reply_to: config.mailReplyTo,
          subject: message.subject,
          text: message.text,
          to: message.to,
        }),
        headers: {
          authorization: `Bearer ${config.resendApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        method: 'POST',
      })
      if (!response.ok) throw new Error('Email delivery failed')
    },
  }
}

export function createServerMailer(config: ServerConfig): Mailer {
  return config.nodeEnv === 'production'
    ? createResendMailer(config)
    : createConsoleMailer(config.nodeEnv)
}

export function createConsoleMailer(nodeEnv: ServerConfig['nodeEnv']): Mailer {
  return {
    send: async (message) => {
      if (nodeEnv !== 'development') throw new Error('Console mailer is development-only')
      console.info(`[Lander development email] ${message.text}`)
    },
  }
}

export async function createAuth({ config, db, mailer }: AuthDependencies) {
  const options = {
    advanced: {
      database: { validateSchema: false },
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: config.trustProxyHeader ? [config.trustProxyHeader] : [] },
    },
    appName: 'Lander NTP',
    basePath: '/api/auth',
    database: db,
    databaseHooks: {
      session: {
        create: {
          before: async (session: { ipAddress?: string | null }) => ({
            data: { ...session, ipAddress: null },
          }),
        },
      },
    },
    plugins: [
      emailOTP({
        allowedAttempts: 3,
        expiresIn: 5 * 60,
        generateOTP: ({ email }) =>
          email.toLowerCase() === config.reviewerEmail ? config.reviewerCode : undefined,
        otpLength: 6,
        sendVerificationOTP: async ({ email, otp }) => {
          if (email.toLowerCase() === config.reviewerEmail && config.reviewerCode) return
          await sendSignInEmail(mailer, email, otp)
        },
        storeOTP: 'hashed',
      }),
      bearer(),
    ],
    rateLimit: {
      customRules: { '/email-otp/send-verification-otp': false as const },
      enabled: true,
      max: 100,
      window: 60,
    },
    secret: config.authSecret,
    session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
    trustedOrigins: [
      ...config.trustedExtensionIds.map((id) => `chrome-extension://${id}`),
      'moz-extension://*',
      ...(config.trustAnyExtensionOrigin ? ['chrome-extension://'] : []),
    ],
  }

  const auth = betterAuth(options)
  const context = await auth.$context
  await context.runMigrations()
  return auth
}
