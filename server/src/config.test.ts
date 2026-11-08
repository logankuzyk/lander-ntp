import { describe, expect, it } from 'vitest'

import { loadBackupConfig, loadConfig } from './config.js'

describe('loadBackupConfig', () => {
  it('loads local restore paths without requiring an authentication secret', () => {
    expect(loadBackupConfig({})).toEqual({
      databasePath: expect.stringMatching(/\/server\/data\/lander\.sqlite$/),
      objectStoreDirectory: expect.stringMatching(/\/server\/data\/objects$/),
    })
  })
})

describe('loadConfig', () => {
  it('rejects a malformed optional heartbeat URL', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'a'.repeat(32), HEARTBEAT_URL: 'not a URL' })).toThrow(
      /HEARTBEAT_URL/,
    )
  })

  it('rejects incomplete R2 credentials', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'a'.repeat(32), R2_ACCOUNT_ID: 'account-id' })).toThrow(
      /must be set together/,
    )
  })

  it('rejects an authentication secret shorter than 32 characters', () => {
    expect(() => loadConfig({ AUTH_SECRET: 'too-short' })).toThrow(/AUTH_SECRET/)
  })

  it('rejects production when a development-only origin switch is enabled', () => {
    expect(() =>
      loadConfig({
        AUTH_SECRET: 'a'.repeat(32),
        NODE_ENV: 'production',
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
