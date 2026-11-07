import { betterAuth } from 'better-auth'
import { bearer, emailOTP } from 'better-auth/plugins'
import type { DatabaseSync } from 'node:sqlite'

import type { ServerConfig } from './config.js'

export type MailMessage = { html: string; subject: string; text: string; to: string }

export type Mailer = { send: (message: MailMessage) => Promise<void> }

type AuthDependencies = {
  config: ServerConfig
  db: DatabaseSync
  mailer: Mailer
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
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
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
        otpLength: 6,
        sendVerificationOTP: async ({ email, otp }) =>
          mailer.send({
            html: `<p>Your Lander sign-in code is <strong>${otp}</strong>. It expires in five minutes. Ignore this email if you did not ask for a code.</p>`,
            subject: 'Your Lander sign-in code',
            text: `Your Lander sign-in code is ${otp}. It expires in five minutes. Ignore this email if you did not ask for a code.`,
            to: email,
          }),
        storeOTP: 'hashed',
      }),
      bearer(),
    ],
    rateLimit: {
      customRules: { '/email-otp/send-verification-otp': { max: 3, window: 60 } },
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
