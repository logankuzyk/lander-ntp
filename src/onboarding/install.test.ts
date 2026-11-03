import { describe, expect, it, vi } from 'vitest'

import { recordInstall } from './install'
import { onboardingItem, pendingItem } from './storage'

// `callouts.ts` has no news at the moment (the Weather's was removed once its options moved onto
// the widget), so these bring their own, as a later release would.
vi.mock('./callouts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./callouts')>()),
  NEWS: [
    { body: 'One.', id: 'first', target: 'edit', title: 'First' },
    { body: 'Two.', id: 'second', target: 'add', title: 'Second' },
  ],
}))

describe('recordInstall', () => {
  it('has a new install welcomed, with none of the news to come', async () => {
    await recordInstall('install')

    // Kept back until the welcome is answered (see pendingItem), then synced.
    expect(await pendingItem.getValue()).toEqual({
      dismissed: ['first', 'second'],
      welcomed: false,
    })
  })

  it('gives an update from before there was a record all of the news and no welcome', async () => {
    await recordInstall('update')

    expect(await onboardingItem.getValue()).toEqual({ dismissed: [], welcomed: true })
  })

  it.each(['install', 'update'])('leaves an existing record alone on %s', async (reason) => {
    // Written by an earlier version, or synced from another device.
    const existing = { dismissed: ['weather'], welcomed: true }
    await onboardingItem.setValue(existing)

    await recordInstall(reason)

    expect(await onboardingItem.getValue()).toEqual(existing)
  })

  it('ignores the browser itself updating', async () => {
    await recordInstall('chrome_update')

    expect(await onboardingItem.getValue()).toBeNull()
  })

  it('treats a record in another shape as none', async () => {
    await onboardingItem.setValue({ welcomed: 'yes' } as never)

    expect(await onboardingItem.getValue()).toBeNull()
  })
})
