import { describe, expect, it } from 'vitest'

import { rule } from '@/test/styles'

describe('Quick dial label layout', () => {
  it('puts the label beside the icon at 3:2 and below in squarer boxes', () => {
    expect(rule('@container (min-aspect-ratio: 3 / 2)')).toContain('flex-direction: row')
    expect(rule('.quick-dial')).toContain('flex-direction: column')
  })
})
