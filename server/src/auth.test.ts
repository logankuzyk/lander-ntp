import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAuth, createResendMailer, createServerMailer, sendSignInEmail } from './auth.js'
import type { ServerConfig } from './config.js'

const config: ServerConfig = {
  authSecret: 'a'.repeat(32),
  databasePath: ':memory:',
  mailFrom: 'Lander <sign-in@example.com>',
  mailReplyTo: 'privacy@example.com',
  nodeEnv: 'test',
  port: 3000,
  resendApiKey: 'test-only-mail-key',
  reviewerCode: undefined,
  reviewerEmail: undefined,
  trustAnyExtensionOrigin: false,
  trustedExtensionIds: [],
  trustProxyHeader: undefined,
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Resend mailer', () => {
  it('skips Better Auth fresh-session checks when its delete route is used', async () => {
    const db = new DatabaseSync(':memory:')
    try {
      const auth = await createAuth(
        { config, db, mailer: { send: async () => undefined } },
        async () => undefined,
      )
      const context = await auth.$context
      expect(context.sessionConfig.freshAge).toBe(0)
    } finally {
      db.close()
    }
  })

  it('uses Resend for production mail without opening a real network connection', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const mailer = createServerMailer({ ...config, nodeEnv: 'production' })

    await sendSignInEmail(mailer, 'person@example.com', '482931')

    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('sends a plain sign-in email with configured addresses and an idempotency key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }))
    const mailer = createResendMailer(config, fetcher)

    await sendSignInEmail(mailer, 'person@example.com', '482931')

    expect(fetcher).toHaveBeenCalledOnce()
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe('https://api.resend.com/emails')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer test-only-mail-key')
    expect(headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'Lander <sign-in@example.com>',
      reply_to: 'privacy@example.com',
      subject: 'Your Lander sign-in code',
      text: 'Your Lander sign-in code is 482931. It expires in five minutes. Ignore this email if you did not ask for a code.',
      to: 'person@example.com',
    })
    expect(String(init?.body)).not.toMatch(/https?:\/\//)
    expect(String(init?.body)).not.toMatch(/track/i)
  })

  it.each([400, 500])(
    'does not expose the mail credential when Resend answers %i',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('credential rejected', { status }))
      const mailer = createResendMailer(config, fetcher)
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      await expect(sendSignInEmail(mailer, 'person@example.com', '482931')).rejects.toThrow(
        /email delivery failed/i,
      )
      expect(log).not.toHaveBeenCalled()
    },
  )
})
