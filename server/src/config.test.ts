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

  it('names invalid environment values and bounds the port', () => {
    const secret = 'a'.repeat(32)

    expect(() => loadConfig({ AUTH_SECRET: secret, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: 'not-a-port' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: '0' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: secret, PORT: '99999' })).toThrow(/PORT/)
    expect(() => loadConfig({ AUTH_SECRET: ' '.repeat(32) })).toThrow(/AUTH_SECRET/)
  })
})
