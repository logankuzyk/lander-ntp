import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports keep modules greppable and lint-friendly.
  imports: false,
  // WXT defaults Firefox to MV2; ship MV3 everywhere.
  manifestVersion: 3,
  // Lazy-loaded: importing the preset at the top level makes WXT's config loader (jiti)
  // evaluate Vite/rolldown, which crashes with "Class extends value undefined".
  vite: async () => {
    const { default: preact } = await import('@preact/preset-vite')
    return { plugins: [preact()] }
  },
  manifest: ({ browser }) => ({
    name: 'Logan Kuzyk Photography — New Tab',
    short_name: 'New Tab',
    description: 'A minimal new tab page featuring photography from logankuzyk.com.',
    homepage_url: 'https://logankuzyk.com',
    // storage.local caches the photo manifest and rotation state. No host permissions: the
    // manifest endpoint sends `Access-Control-Allow-Origin: *`. `favicon` reads Chromium's own
    // favicon cache for favourite sites; Firefox has no such API and uses a letter monogram.
    permissions: browser === 'firefox' ? ['storage'] : ['storage', 'favicon'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'lander-ntp@logankuzyk.com',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
        // data_collection_permissions landed in Firefox for Android 142.
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
})
