import { build } from 'esbuild'
import { resolve } from 'node:path'

const external = ['@hono/node-server', 'aws4fetch', 'better-auth', 'hono']

await build({
  alias: { '@': resolve('../src') },
  bundle: true,
  entryPoints: ['src/main.ts', 'src/restore.ts'],
  external,
  format: 'esm',
  nodePaths: [resolve('node_modules')],
  outdir: 'dist',
  platform: 'node',
  target: 'node24',
  tsconfigRaw: { compilerOptions: { target: 'ES2023' } },
})
