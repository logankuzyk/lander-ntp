import { describe, expect, it } from 'vitest'

import { css, rule } from '@/test/styles'

/** Every `@media (prefers-reduced-motion: reduce)` block: where it starts and what is in it. */
function reducedMotionBlocks() {
  const blocks: { body: string; start: number }[] = []
  const opener = '@media (prefers-reduced-motion: reduce) {'
  for (let start = css.indexOf(opener); start !== -1; start = css.indexOf(opener, start + 1)) {
    let depth = 0
    let end = start + opener.length - 1
    for (let i = end; i < css.length; i++) {
      if (css[i] === '{') depth++
      if (css[i] === '}' && --depth === 0) {
        end = i
        break
      }
    }
    blocks.push({ body: css.slice(start + opener.length, end), start })
  }
  return blocks
}

/**
 * happy-dom cannot lay anything out, so these guard what a real browser was needed to find (the
 * measurements are in the pull request).
 */
describe('the setup button styles', () => {
  it('stops its transition under reduced motion, in a block after its own rule, which would win otherwise', () => {
    const own = css.indexOf('\n.widget-setup {')
    expect(own).toBeGreaterThan(-1)
    expect(rule('.widget-setup')).toMatch(/transition:/)

    const after = reducedMotionBlocks().filter(
      ({ body, start }) =>
        start > own && /\.widget-setup\s*\{[^}]*transition:\s*none/.test(body.replace(/\s+/g, ' ')),
    )

    expect(after.length).toBeGreaterThan(0)
  })

  it('has no widget rule in a reduced-motion block that a later rule of the same selector overrides', () => {
    for (const { body, start } of reducedMotionBlocks()) {
      const selectors = [...body.matchAll(/([^{}]+)\{[^}]*transition:\s*none/g)].flatMap((match) =>
        (match[1] ?? '').split(',').map((selector) => selector.trim()),
      )
      for (const selector of selectors.filter((selector) => selector.startsWith('.widget-'))) {
        const later = css.indexOf(`\n${selector} {`, start)
        expect(later, `${selector} is set again after its reduced-motion block`).toBe(-1)
      }
    }
  })

  it('draws no ring round a box that was handed focus outside edit mode, and keeps the frame ring in it', () => {
    expect(rule('.widget-box:focus')).toMatch(/outline:\s*none/)
    // The frame's ring is more specific (it names the grid), so it still wins in edit mode.
    expect(rule('.grid--editing .widget-box:focus-visible')).toMatch(/outline:\s*2px solid/)
  })

  it('keeps clear of the Options button and the name in edit mode, in a box tall enough to', () => {
    const edit = css.indexOf('.grid--editing .widget-setup {')
    expect(edit).toBeGreaterThan(-1)
    // Inside a container query on the box's height, which is what makes room for the margins.
    const query = css.lastIndexOf('@container', edit)
    expect(query).toBeGreaterThan(-1)
    expect(css.slice(query, edit)).toMatch(/min-height/)
    const text = css.slice(edit, css.indexOf('}', edit))
    expect(text).toMatch(/margin-block:\s*2\.25rem/)
    expect(text).toMatch(/max-height:\s*calc\(100% - 4rem\)/)
  })
})
