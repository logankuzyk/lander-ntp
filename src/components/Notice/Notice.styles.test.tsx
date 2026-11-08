import { describe, expect, it } from 'vitest'

import { rule } from '@/test/styles'

describe('the Notice styles', () => {
  it('centres every part of the notice on its shared horizontal axis', () => {
    expect(rule('.callout--notice .callout__header')).toMatch(/align-items:\s*center/)
    expect(rule('.callout__header')).toMatch(/gap:\s*0\.75rem/)
  })

  it('lets a long message wrap inside the available width while keeping both buttons intact', () => {
    expect(rule('.callout--has-action .callout__header span')).toMatch(/flex:\s*1 1 auto/)
    expect(rule('.callout--has-action .callout__header span')).toMatch(/min-width:\s*0/)
    expect(rule('.callout--has-action .callout__header span')).toMatch(/overflow-wrap:\s*anywhere/)
    expect(rule('.callout--has-action .callout__header button')).toMatch(/flex:\s*none/)
    expect(rule('.callout--has-action')).toMatch(/max-width:\s*calc\(100vw - 3rem\)/)
  })
})
