import { describe, expect, it } from 'vitest'

import { css, rule } from '@/test/styles'

describe('the Analog clock styles', () => {
  it('uses an SVG viewBox that keeps the dial square inside its Widget box', () => {
    expect(rule('.analog-clock__dial')).toMatch(/width:\s*100%/)
    expect(rule('.analog-clock__dial')).toMatch(/height:\s*100%/)
    expect(rule('.analog-clock')).toMatch(/place-items:\s*center/)
  })

  it('gives the hands rounded ends and keeps the seconds hand thin', () => {
    expect(rule('.analog-clock__hand')).toMatch(/stroke-linecap:\s*round/)
    expect(rule('.analog-clock__hand--second')).toMatch(/stroke-width:\s*0\.8/)
  })

  it('removes the seconds-hand tick animation for reduced motion', () => {
    expect(rule('.analog-clock__hand--second')).toMatch(/animation:\s*analog-tick/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.analog-clock__hand--second\s*\{\s*animation:\s*none/,
    )
  })
})
