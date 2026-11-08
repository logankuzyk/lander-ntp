import { describe, expect, it } from 'vitest'

import { pruneExpiredSyncWrites } from './syncWriteLimit.js'

describe('pruneExpiredSyncWrites', () => {
  it('removes expired session histories and keeps recent writes', () => {
    const now = 100_000
    const writes = new Map([
      ['active-session', [now - 60_001, now - 59_999]],
      ['expired-session', [now - 60_000]],
    ])

    pruneExpiredSyncWrites(writes, now)

    expect([...writes]).toEqual([['active-session', [now - 59_999]]])
  })
})
