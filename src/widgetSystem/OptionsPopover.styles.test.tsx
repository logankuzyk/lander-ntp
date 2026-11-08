import { describe, expect, it } from 'vitest'

import { css, rule } from '@/test/styles'

/**
 * happy-dom cannot lay anything out, so these guard the rules a real browser was needed to find
 * (the measurements are in the pull request).
 */
describe('the options popover styles', () => {
  it('does not move the "Couldn’t save that" note to the top of a narrow page', () => {
    // The note jumps to the top for as long as the corner popovers (settings, photo details)
    // are open, as they reach the photo credit's side. The options popover is by its Widget, not
    // in that corner, and at 390 px the note at the top covers its title.
    const afterAPopover = css.match(/[^\n{},]*~ \.notice/g) ?? []

    expect(afterAPopover.length).toBeGreaterThan(0)
    for (const selector of afterAPopover) {
      expect(selector.trim()).toBe('.popover:not(.options-popover) ~ .notice')
    }
  })

  it('is placed from the script: it has no corner of its own', () => {
    const popover = rule('.options-popover')

    expect(popover).toMatch(/right:\s*auto/)
    expect(popover).toMatch(/bottom:\s*auto/)
  })
})
