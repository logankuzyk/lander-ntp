import { describe, expect, it } from 'vitest'

import { runRestore } from './restore.js'

describe('restore CLI', () => {
  it('requires a key and destination before accessing storage', async () => {
    await expect(runRestore([])).rejects.toThrow(/Usage:/)
    await expect(runRestore(['latest', '--to'])).rejects.toThrow(/Usage:/)
  })
})
