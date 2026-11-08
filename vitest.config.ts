import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // Applies wxt.config.ts (Preact plugin, aliases) and polyfills `browser` with fakeBrowser.
  plugins: [WxtVitest()],
  test: {
    coverage: {
      exclude: [
        'src/entrypoints/**/main.tsx',
        // Test scaffolding, including the frozen v0.2.3 reader, which no one is to improve.
        'src/test/compat/**',
        '**/*.test.{ts,tsx}',
        '**/*.stories.tsx',
      ],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
    },
    environment: 'happy-dom',
    // Agent worktrees are whole copies of the repo, tests included.
    exclude: [...configDefaults.exclude, '.claude/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
