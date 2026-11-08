import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'wxt/browser': fileURLToPath(
        new URL('./node_modules/wxt/dist/virtual/mock-browser.mjs', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./.tmp-vitest.setup.ts', './vitest.setup.ts'],
  },
})
