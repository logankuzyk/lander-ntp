import { describe, expect, it } from 'vitest'

import { MARKS } from './callouts'
import { recordInstall } from './install'
import { onboardingItem, pendingItem } from './storage'

// With the news as it ships (install.test.ts brings its own): the note about the Layout.
describe('recordInstall, with the news that ships', () => {
  it('has a new install record the update note as seen: the welcome tour covers it', async () => {
    await recordInstall('install')

    expect(await pendingItem.getValue()).toEqual({
      dismissed: ['layout', ...MARKS],
      welcomed: false,
    })
    expect(await onboardingItem.getValue()).toEqual({
      dismissed: ['layout', ...MARKS],
      welcomed: false,
    })
  })

  it('gives an update from before there was a record the note, with no welcome', async () => {
    await recordInstall('update')

    expect(await onboardingItem.getValue()).toEqual({ dismissed: [], welcomed: true })
  })

  it('leaves the record of a person already on v0.2.3 alone, so the note is still to come', async () => {
    // What v0.2.3 stored: it had seen the Weather's news, and been welcomed.
    const v023 = { dismissed: ['weather'], welcomed: true }
    await onboardingItem.setValue(v023)

    await recordInstall('update')

    expect(await onboardingItem.getValue()).toEqual(v023)
  })
})
