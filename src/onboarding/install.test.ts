import { describe, expect, it } from 'vitest'

import { NEWS } from './callouts'
import { recordInstall } from './install'
import { onboardingItem } from './storage'

describe('recordInstall', () => {
  it('has a new install welcomed, with none of the news to come', async () => {
    await recordInstall('install')

    expect(await onboardingItem.getValue()).toEqual({
      dismissed: NEWS.map(({ id }) => id),
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
