import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(import.meta.dirname, '../ops/stand-up.sh')

describe('server stand-up guide', () => {
  it('prints the compose and reverse-proxy examples without opening a wizard', () => {
    const output = execFileSync('bash', [scriptPath, '--print-snippets'], { encoding: 'utf8' })

    expect(output).toContain('services:')
    expect(output).toContain('image: ghcr.io/OWNER/lander-server:TAG')
    expect(output).toContain('proxy_pass http://127.0.0.1:3000;')
    expect(output).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
    expect(output).not.toContain('AUTH_SECRET=')
  })

  it('includes DNS, certificate, approved SSH, and health checks in the guide', () => {
    const script = readFileSync(scriptPath, 'utf8')

    expect(script).toContain('dig +short')
    expect(script).toContain('openssl s_client')
    expect(script).toContain('docker compose version')
    expect(script).toContain('curl --fail --silent --show-error')
    expect(script).toContain('confirm')
  })
})
