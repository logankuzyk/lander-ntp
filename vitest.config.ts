import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // Applies wxt.config.ts (Preact plugin, aliases) and polyfills `browser` with fakeBrowser.
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // The Worker runs its own tests, outside the browser environment set up here.
    exclude: [...configDefaults.exclude, 'telemetry-worker/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/entrypoints/**/main.tsx', '**/*.test.{ts,tsx}'],
    },
  },
})
