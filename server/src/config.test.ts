import { describe, expect, it } from 'vitest'

import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('rejects an authentication secret shorter than 32 characters', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'too-short' })).toThrow(/AUTH_SECRET/)
  })

  it('rejects production when a development-only origin switch is enabled', () => {
    expect(() =>
      loadConfig({
        AUTH_SECRET: 'a'.repeat(32),
        MAIL_FROM: 'Lander <sign-in@example.com>',
        MAIL_REPLY_TO: 'privacy@example.com',
        NODE_ENV: 'production',
        RESEND_API_KEY: 'test-only-mail-key',
        TRUST_ANY_EXTENSION_ORIGIN: 'true',
      }),
    ).toThrow(/production/i)
  })

  it('rejects an empty database path instead of opening a temporary database', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'a'.repeat(32), DATABASE_PATH: '' })).toThrow(
      /DATABASE_PATH/,
    )
  })

  it('resolves the default database path from the server package', () => {
    expect(loadConfig({ AUTH_SECRET: 'a'.repeat(32) }).databasePath).toMatch(
      /\/server\/data\/lander\.sqlite$/,
    )
  })

  it('uses safe defaults for NODE_ENV and PORT', () => {
    const config = loadConfig({ AUTH_SECRET: 'a'.repeat(32) })

    expect(config.nodeEnv).toBe('development')
    expect(config.port).toBe(3000)
  })

  it('loads optional mail, reviewer and proxy settings without setting defaults', () => {
    const config = loadConfig({
      AUTH_SECRET: 'a'.repeat(32),
      MAIL_FROM: 'Lander <sign-in@example.com>',
      MAIL_REPLY_TO: 'privacy@example.com',
      RESEND_API_KEY: 'test-only-mail-key',
      REVIEWER_CODE: '482931',
      REVIEWER_EMAIL: 'Reviewer@Example.com',
      TRUST_PROXY_HEADER: 'cf-connecting-ip',
    })

    expect(config.resendApiKey).toBe('test-only-mail-key')
    expect(config.mailFrom).toBe('Lander <sign-in@example.com>')
    expect(config.mailReplyTo).toBe('privacy@example.com')
    expect(config.reviewerCode).toBe('482931')
    expect(config.reviewerEmail).toBe('reviewer@example.com')
    expect(config.trustProxyHeader).toBe('cf-connecting-ip')
    expect(loadConfig({ AUTH_SECRET: 'a'.repeat(32) })).toMatchObject({
      mailFrom: undefined,
      mailReplyTo: undefined,
      resendApiKey: undefined,
      reviewerCode: undefined,
      reviewerEmail: undefined,
      trustProxyHeader: undefined,
    })
  })

  it('requires complete production mail configuration and paired reviewer settings', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'a'.repeat(32), NODE_ENV: 'production' })).toThrow(
      /RESEND_API_KEY/,
    )
    expect(() =>
      loadConfig({ AUTH_SECRET: 'a'.repeat(32), REVIEWER_EMAIL: 'reviewer@example.com' }),
    ).toThrow(/REVIEWER_EMAIL and REVIEWER_CODE/)
  })

  it('includes the store ID and parses additional trusted extension IDs', () => {
    const config = loadConfig({
      AUTH_SECRET: 'a'.repeat(32),
      TRUSTED_EXTENSION_IDS: 'edge-id, chrome-id, edge-id',
    })

    expect(config.trustedExtensionIds).toEqual([
      'ocglhjclnhfbgbccffinhioaangigioa',
      'edge-id',
      'chrome-id',
    ])
  })

  it('names invalid environment values and bounds the port', () => {
    const secret = 'a'.repeat(32)

    expect(() => loadConfig({ AUTH_SECRET: secret, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: 'not-a-port' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: '0' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: '99999' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: ' '.repeat(32) })).toThrow(/AUTH_SECRET/)
  })
})
