import { describe, expect, it } from 'vitest'

import { css, rule } from '@/test/styles'

/**
 * happy-dom cannot lay anything out, so these only guard the rules a callout beside its target
 * needs (measured in a real browser, on the built Storybook; see the pull request).
 */
describe('the styles of a callout beside its target', () => {
  it('draws no ring: nothing outlines the target, only the callout has a pointer', () => {
    expect(css).not.toMatch(/callout-ring|callout--ring/)
    expect(css).not.toMatch(/\[data-callout-target[^\]]*\][^{]*\{[^}]*(outline|box-shadow)/)
  })

  it('moves by script and not by animation: no transition on its place', () => {
    expect(rule('.callout--beside')).not.toMatch(/transition|animation/)
    // The callout's own transition is the fade, on opacity alone.
    expect(css).toMatch(/\.welcome,\s*\.callout\s*\{[^}]*transition:\s*opacity/)
  })

  it('has the fade-in turned off when the browser reports reduced motion', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .welcome,\n  .callout')
    expect(start).toBeGreaterThan(-1)
    const block = css.slice(start, css.indexOf('\n}\n', start))
    expect(block).toMatch(/animation:\s*none/)
    expect(block).toMatch(/transition:\s*none/)
  })

  it('points from the edge facing its target, whichever side that is', () => {
    for (const side of ['above', 'below', 'left', 'right']) {
      expect(css).toContain(`.callout--beside[data-side='${side}']::after`)
    }
    expect(rule(".callout--beside[data-side='right']::after")).toMatch(/right:\s*100%/)
    expect(rule(".callout--beside[data-side='left']::after")).toMatch(/left:\s*100%/)
  })

  it('leaves the pointer unpressable: it is no box of its own', () => {
    expect(css).toMatch(
      /\.callout--beside::before,\s*\.callout--beside::after\s*\{[^}]*pointer-events:\s*none/,
    )
  })
})
