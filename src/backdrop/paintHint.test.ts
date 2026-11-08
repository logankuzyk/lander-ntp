import { describe, expect, it } from 'vitest'

import { applyBackgroundHint, BACKGROUND_HINT_KEY } from './paintHint'

describe('applyBackgroundHint', () => {
  it('sets the solid background and page ink before the page paints', () => {
    const root = document.createElement('html')
    applyBackgroundHint(root, () =>
      JSON.stringify({ colour: '#f2e8cf', ink: '#111', kind: 'colour' }),
    )

    expect(root.style.getPropertyValue('--color-bg')).toBe('#f2e8cf')
    expect(root.dataset.ink).toBe('dark')
  })

  it('does not fail when local storage throws', () => {
    const root = document.createElement('html')
    expect(() =>
      applyBackgroundHint(root, () => {
        throw new Error('blocked')
      }),
    ).not.toThrow()
    expect(root.style.getPropertyValue('--color-bg')).toBe('')
  })

  it('ignores stale or malformed hints', () => {
    const root = document.createElement('html')
    applyBackgroundHint(root, () => '{"kind":"photo"}')
    expect(root.dataset.ink).toBeUndefined()
    expect(root.style.getPropertyValue('--color-bg')).toBe('')
  })

  it('rejects a valid colour followed by trailing characters', () => {
    const root = document.createElement('html')
    applyBackgroundHint(root, () =>
      JSON.stringify({ colour: '#f2e8cfbroken', ink: '#111', kind: 'colour' }),
    )

    expect(root.style.getPropertyValue('--color-bg')).toBe('')
    expect(root.dataset.ink).toBeUndefined()
  })

  it('uses the same key that the background hook persists', () => {
    expect(BACKGROUND_HINT_KEY).toBe('lander:background-hint')
  })
})
