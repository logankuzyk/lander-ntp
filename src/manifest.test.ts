import { describe, expect, it } from 'vitest'
import type { ConfigEnv } from 'wxt'

import config from '../wxt.config'

describe('extension manifest permissions', () => {
  it.each(['chrome', 'firefox', 'edge'] as const)(
    'declares permissions for %s',
    async (browser) => {
      const manifestFactory = config.manifest
      if (typeof manifestFactory !== 'function') throw new Error('Manifest must be a function')
      const env: ConfigEnv = {
        browser,
        command: 'build',
        manifestVersion: 3,
        mode: 'production',
      }
      const manifest = await manifestFactory(env)

      expect(manifest.permissions).toEqual(['storage'])
      expect(manifest.optional_permissions).toEqual(['bookmarks'])
      expect(manifest).not.toHaveProperty('host_permissions')
      expect(manifest).not.toHaveProperty('optional_host_permissions')

      if (browser === 'firefox') {
        expect(manifest.browser_specific_settings?.gecko?.data_collection_permissions).toEqual({
          optional: ['locationInfo'],
          required: ['none'],
        })
      }
    },
  )
})
