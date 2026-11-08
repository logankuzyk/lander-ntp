import { describe, expect, it } from 'vitest'

import { siteIconUrl } from './siteIconUrl'

describe('siteIconUrl', () => {
  it('requests the favicon directly from the site host', () => {
    expect(siteIconUrl('example.com')).toBe('https://example.com/favicon.ico')
  })
})
