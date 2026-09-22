import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // Applies wxt.config.ts (Preact plugin, aliases) and polyfills `browser` with fakeBrowser.
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/entrypoints/**/main.tsx', '**/*.test.{ts,tsx}'],
    },
  },
})
