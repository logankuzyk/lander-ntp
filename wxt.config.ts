import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

import { accountHostPermission, PRODUCTION_SERVER_URL } from './src/account/serverAddress'

// See https://wxt.dev/api/config.html
export default defineConfig({
  dev: {
    // The local website (see README) runs on 3000. If WXT took that port first, Next.js would
    // move to 3001 and WXT_PHOTO_MANIFEST_URL would point at WXT's own dev server.
    server: { port: 3100 },
  },
  hooks: {
    // One profile per browser, since Chrome and Edge can't share a user data dir. Set here
    // because the webExt option can't vary by browser. `wxt clean` deletes them.
    'config:resolved': (wxt) => {
      if (wxt.config.command !== 'serve' || wxt.config.browser === 'firefox') return
      const { config } = wxt.config.webExt
      config.chromiumProfile ??= resolve(`.wxt/${wxt.config.browser}-profile`)
      // web-ext and Chrome won't create it themselves.
      mkdirSync(config.chromiumProfile, { recursive: true })
    },
  },
  // Explicit imports keep modules greppable and lint-friendly.
  imports: false,
  manifest: async ({ browser, mode }) => {
    const { loadEnv } = await import('vite')
    const serverUrl =
      loadEnv(mode, process.cwd(), 'WXT_').WXT_SERVER_URL ??
      process.env.WXT_SERVER_URL ??
      PRODUCTION_SERVER_URL
    return {
      description: 'A minimal new tab page featuring photography from logankuzyk.com.',
      homepage_url: 'https://logankuzyk.com',
      name: 'Lander',
      // The account API origin is separate from the photo and weather endpoints, which use CORS.
      optional_host_permissions: [accountHostPermission(serverUrl)],
      permissions: ['storage'],
      ...(browser === 'firefox' && {
        browser_specific_settings: {
          gecko: {
            // Sending a place for the forecast and sending an email for account sync are both
            // consented. Required stays none, so install and update do not prompt.
            data_collection_permissions: {
              optional: ['locationInfo', 'personallyIdentifyingInfo', 'authenticationInfo'],
              required: ['none'],
            },
            id: 'lander-ntp@logankuzyk.com',
            strict_min_version: '140.0',
          },
          // data_collection_permissions landed in Firefox for Android 142.
          gecko_android: { strict_min_version: '142.0' },
        },
        // Lists the page under Settings > Home > "Homepage and new windows". Firefox keeps that
        // separate from new tabs, which chrome_url_overrides covers.
        chrome_settings_overrides: { homepage: 'newtab.html' },
      }),
    }
  },
  // WXT defaults Firefox to MV2; ship MV3 everywhere.
  manifestVersion: 3,
  srcDir: 'src',
  // Lazy-loaded: importing the preset at the top level makes WXT's config loader (jiti)
  // evaluate Vite/rolldown, which crashes with "Class extends value undefined".
  vite: async () => {
    const { default: preact } = await import('@preact/preset-vite')
    return { plugins: [preact()] }
  },
  // `npm run dev` browser. Personal overrides (e.g. a Chrome Canary binary) go in a
  // gitignored web-ext.config.ts, which takes precedence.
  webExt: {
    // Reuse the same profile between runs, so settings and the cached photo
    // manifest survive a restart instead of starting from a blank install every time.
    keepProfileChanges: true,
  },
})
