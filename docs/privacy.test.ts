import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('privacy copy', () => {
  it('describes the account and no-account cases separately', () => {
    const policy = read('../PRIVACY.md')

    expect(policy).toContain('## Without an account')
    expect(policy).toContain('## If you sign in')
    expect(policy).toContain(
      'Without an account, Lander sends no account data to its server. It still stores your Layout, settings, photo list cache, current photo and weather cache in your browser.',
    )
    expect(policy).not.toContain('Without an account, Lander stores nothing about you.')
    expect(policy).not.toContain('Lander does not collect, sell or share any personal information.')
  })

  it('uses the approved account description and links the complete policy from the README', () => {
    const readme = read('../README.md')

    expect(readme).toContain(
      'No account needed: without one, Lander sends no account data to its server. It still stores your Layout and settings in your browser.',
    )
    expect(readme).toContain('optional account')
    expect(readme).toContain('server/README.md')
    expect(readme).toContain('WXT_SERVER_URL')
  })

  it('keeps the approved listing sentence in the listing draft', () => {
    expect(read('./store-listing-copy.md')).toContain(
      "Without an account, Lander stores nothing about you. Weather asks Open-Meteo for your chosen place's forecast.",
    )
  })
})
