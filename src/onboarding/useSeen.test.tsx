import { act, renderHook, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { onboardingItem } from './storage'
import { useSeen } from './useSeen'

describe('useSeen', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
  })

  it('shows an unseen mark and records it without losing other onboarding ids', async () => {
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })

    const { result } = renderHook(() => useSeen('new-widget'))
    await waitFor(() => expect(result.current.seen).toBe(false))

    await act(async () => result.current.markSeen())

    expect(await onboardingItem.getValue()).toEqual({
      dismissed: ['layout', 'new-widget'],
      welcomed: true,
    })

    const secondDevice = renderHook(() => useSeen('new-widget'))
    await waitFor(() => expect(secondDevice.result.current.seen).toBe(true))
  })
})
