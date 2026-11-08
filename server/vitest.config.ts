import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2023' } }) },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../src'),
      valibot: resolve(import.meta.dirname, 'node_modules/valibot/dist/index.mjs'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
