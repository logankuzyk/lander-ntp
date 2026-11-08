import { describe, expect, it } from 'vitest'

import { canon, mergeOnboarding, planFirstSignIn, planPull } from './planning'

describe('sync planning', () => {
  it('takes this browser’s settings when the account has no copy', () => {
    const settings = { clock: { enabled: true }, v: 1 }

    expect(planFirstSignIn({ settings }, {})).toBe('upload')
  })

  it('canonicalizes object keys without changing array order', () => {
    const value = JSON.parse('{"z":1,"nested":{"y":2,"x":3},"a":[2,1]}')
    expect(canon(value)).toBe('{"a":[2,1],"nested":{"x":3,"y":2},"z":1}')
  })

  it('merges onboarding by keeping every dismissed callout and either welcome', () => {
    expect(
      mergeOnboarding(
        { dismissed: ['weather'], welcomed: false },
        { dismissed: ['accounts'], welcomed: true },
      ),
    ).toEqual({ dismissed: ['accounts', 'weather'], welcomed: true })
  })

  it('pulls only remote values that changed since the saved snapshot', () => {
    expect(
      planPull(
        { onboarding: { dismissed: [] }, settings: { dim: false } },
        { onboarding: { dismissed: ['weather'] }, settings: { dim: true } },
        { onboarding: { dismissed: [] }, settings: { dim: false } },
      ),
    ).toEqual({
      onboarding: { dismissed: ['weather'], welcomed: false },
      settings: { dim: true },
    })
  })
})
