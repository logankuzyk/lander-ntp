import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { tsconfigRaw: { compilerOptions: { module: 'ESNext', target: 'ES2023' } } },
  resolve: { alias: { '@': resolve(import.meta.dirname, '../src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
