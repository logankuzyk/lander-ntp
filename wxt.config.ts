import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

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
  manifest: ({ browser }) => ({
    description: 'A minimal new tab page featuring photography from logankuzyk.com.',
    homepage_url: 'https://logankuzyk.com',
    name: 'Lander',
    // storage.local caches the photo manifest, rotation state and weather. No host
    // permissions: the manifest endpoint and Open-Meteo send `Access-Control-Allow-Origin: *`.
    permissions: ['storage'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Firefox requires this. Nothing is collected unless the weather widget is switched
          // on, which sends the chosen place to the forecast service and asks for this first.
          data_collection_permissions: { optional: ['locationInfo'], required: ['none'] },
          id: 'lander-ntp@logankuzyk.com',
          strict_min_version: '140.0',
        },
        // data_collection_permissions landed in Firefox for Android 142.
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
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
