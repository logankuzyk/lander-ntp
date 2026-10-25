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
})
