import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(import.meta.dirname, '../ops/stand-up.sh')
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

function runWizard(
  options: {
    answers?: string
    dns?: string
    health?: 'good' | 'wrong-then-good'
    tls?: 'bad-then-good' | 'good'
  } = {},
) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'lander-stand-up-'))
  temporaryDirectories.push(temporaryDirectory)
  const binDirectory = join(temporaryDirectory, 'bin')
  mkdirSync(binDirectory)
  const fakeTool = join(binDirectory, 'fake-tool')
  const fakeToolSource = [
    '#!/bin/sh',
    'tool=$TOOL_NAME',
    'printf "%s\\n" "$*" >> "$FAKE_LOG_DIR/$tool.log"',
    'case "$tool" in',
    '  dig) count=$(wc -l < "$FAKE_LOG_DIR/dig.log"); if [ "$FAKE_DNS" = wrong-then-good ] && [ "$count" -eq 1 ]; then printf "%s\\n" "203.0.113.11"; else printf "%s\\n" "203.0.113.10"; fi ;;',
    '  openssl) count=$(wc -l < "$FAKE_LOG_DIR/openssl.log"); if [ "$FAKE_TLS" = bad-then-good ] && [ "$count" -eq 1 ]; then printf "%s\\n" "Verify return code: 62 (hostname mismatch)"; else printf "%s\\n" "Verify return code: 0 (ok)"; fi ;;',
    '  curl) count=$(wc -l < "$FAKE_LOG_DIR/curl.log"); if [ "$FAKE_HEALTH" = wrong-then-good ] && [ "$count" -eq 1 ]; then printf "%s" "not-healthy"; else printf "%s" "{\\"ok\\":true}"; fi ;;',
    'esac',
    '',
  ].join('\n')
  writeFileSync(fakeTool, fakeToolSource)
  chmodSync(fakeTool, 0o755)
  for (const tool of ['curl', 'dig', 'openssl', 'ssh']) {
    const toolPath = join(binDirectory, tool)
    writeFileSync(toolPath, `#!/bin/sh\nTOOL_NAME=${tool} exec "${fakeTool}" "$@"\n`)
    chmodSync(toolPath, 0o755)
  }
  const result = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FAKE_DNS: options.dns ?? 'good',
      FAKE_HEALTH: options.health ?? 'good',
      FAKE_LOG_DIR: temporaryDirectory,
      FAKE_TLS: options.tls ?? 'good',
      PATH: `${binDirectory}:${process.env.PATH}`,
    },
    input:
      options.answers ?? '\napi.example.test\n\n203.0.113.10\n\ndeploy@api.example.test\ny\n\n\n\n',
    timeout: 3000,
  })
  const log = (tool: string) => {
    try {
      return readFileSync(join(temporaryDirectory, `${tool}.log`), 'utf8')
    } catch {
      return ''
    }
  }
  return { error: result.error, log, output: result.stdout, status: result.status }
}

describe('server stand-up guide', () => {
  it('prints the compose and reverse-proxy examples without opening a wizard', () => {
    const output = execFileSync('bash', [scriptPath, '--print-snippets'], { encoding: 'utf8' })

    expect(output).toContain('services:')
    expect(output).toContain('image: ghcr.io/OWNER/lander-server:TAG')
    expect(output).toContain('proxy_pass http://127.0.0.1:3000;')
    expect(output).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;')
    expect(output).not.toContain('AUTH_SECRET=')
  })

  it('asks OpenSSL to verify the peer chain and configured hostname', () => {
    const { log, status } = runWizard()

    expect(status).toBe(0)
    expect(log('openssl')).toContain('-verify ')
    expect(log('openssl')).toContain('-verify_hostname api.example.test')
  })

  it('does not pass the DNS stage until the A record matches the VPS address', () => {
    const { log, status } = runWizard({ dns: 'wrong-then-good' })

    expect(status).toBe(0)
    expect(log('dig').trim().split('\n')).toHaveLength(2)
  })

  it('rejects an empty hostname before checking DNS', () => {
    const answers = '\n\n\n203.0.113.10\n\ndeploy@api.example.test\ny\n\n\n\n'
    const { log, status } = runWizard({ answers })

    expect(status).toBe(1)
    expect(log('dig')).toBe('')
  })

  it('does not run the SSH command when the owner declines it', () => {
    const answers = '\napi.example.test\n\n203.0.113.10\n\ndeploy@api.example.test\nn\n\n\n\n'
    const { log, status } = runWizard({ answers })

    expect(status).toBe(0)
    expect(log('ssh')).toBe('')
  })

  it('retries a TLS failure and only continues after verification succeeds', () => {
    const { log, status } = runWizard({ tls: 'bad-then-good' })

    expect(status).toBe(0)
    expect(log('openssl').trim().split('\n')).toHaveLength(2)
  })

  it('retries a non-healthy response and requests only the health path', () => {
    const { log, status } = runWizard({ health: 'wrong-then-good' })

    expect(status).toBe(0)
    expect(log('curl').trim().split('\n')).toHaveLength(2)
    expect(log('curl')).toContain('https://api.example.test/health')
  })
})
