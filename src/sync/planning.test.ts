import { describe, expect, it } from 'vitest'

import { canon, mergeOnboarding, planFirstSignIn, planPull } from './planning'

describe('sync planning', () => {
  it('takes this browser’s settings when the account has no copy', () => {
    const settings = { clock: { enabled: true }, v: 1 }

    expect(planFirstSignIn({ settings }, {})).toBe('upload')
  })

  it('recognizes a stored Layout as arranged', () => {
    expect(planFirstSignIn({ layout: { widgets: [] } }, {})).toBe('upload')
  })

  it('downloads an arranged account copy when this browser has nothing arranged', () => {
    expect(planFirstSignIn({}, { settings: { dim: false } })).toBe('download')
  })

  it('merges differing onboarding without asking when arranged settings match', () => {
    expect(
      planFirstSignIn(
        { onboarding: { dismissed: ['weather'] }, settings: { dim: false } },
        { onboarding: { dismissed: [] }, settings: { dim: false } },
      ),
    ).toBe('nothing')
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

  it('keeps the local value when devices disagree on an unknown onboarding field', () => {
    expect(
      mergeOnboarding(
        { dismissed: [], futureField: 'local', welcomed: false },
        { dismissed: [], futureField: 'remote', welcomed: false },
      ),
    ).toEqual({ dismissed: [], futureField: 'local', welcomed: false })
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

  it('keeps a newer local item when the remote item has an older version', () => {
    expect(
      planPull(
        { settings: { v: 2, value: 'local' } },
        { settings: { v: 1, value: 'remote' } },
        { settings: { v: 2, value: 'local' } },
      ),
    ).toEqual({})
  })

  it('pulls a higher-version remote item even when local content changed', () => {
    expect(
      planPull(
        { settings: { v: 1, value: 'local edit' } },
        { settings: { v: 2, value: 'server' } },
        { settings: { v: 1, value: 'last synced' } },
      ),
    ).toEqual({ settings: { v: 2, value: 'server' } })
  })

  it('pulls changed content when settings versions are equal', () => {
    expect(
      planPull(
        { settings: { v: 2, value: 'local' } },
        { settings: { v: 2, value: 'remote' } },
        { settings: { v: 2, value: 'local' } },
      ),
    ).toEqual({ settings: { v: 2, value: 'remote' } })
  })

  it('treats absent settings and onboarding versions as version 1', () => {
    expect(
      planPull(
        {
          onboarding: { dismissed: [], welcomed: false },
          settings: { value: 'local' },
        },
        {
          onboarding: { dismissed: ['weather'], welcomed: true },
          settings: { value: 'remote' },
        },
        {
          onboarding: { dismissed: [], welcomed: false },
          settings: { value: 'local' },
        },
      ),
    ).toEqual({
      onboarding: { dismissed: ['weather'], welcomed: true },
      settings: { value: 'remote' },
    })
  })
})
