import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2023' } }) },
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'node',
    exclude: configDefaults.exclude,
    include: ['integration/**/*.test.ts'],
  },
})
